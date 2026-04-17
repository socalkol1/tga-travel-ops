import { addHours } from "date-fns";
import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { db, type Transaction } from "@/lib/db/client";
import { documentPackets, enrollments, fileArtifacts, tokenLinks } from "@/lib/db/schema";
import { env } from "@/lib/env/server";
import { uploadPrivateArtifact } from "@/lib/providers/storage/supabase";
import { generateOpaqueToken, hashToken } from "@/lib/security/tokens";
import { recordAuditEvent } from "@/modules/audit/service";
import { refreshEnrollmentReadiness } from "@/modules/enrollments/service";

const allowedInsuranceMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const maxInsuranceUploadBytes = 10 * 1024 * 1024;

function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "insurance-card";
}

export async function issueInsuranceUploadTokenTx(
  tx: Transaction,
  input: {
    enrollmentId: string;
    recipientEmail: string;
  },
) {
  const now = new Date();
  const rawToken = generateOpaqueToken();
  const expiresAt = addHours(now, env.TOKEN_TTL_HOURS);
  const normalizedRecipientEmail = input.recipientEmail.trim().toLowerCase();

  await tx
    .update(tokenLinks)
    .set({
      expiresAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(tokenLinks.enrollmentId, input.enrollmentId),
        eq(tokenLinks.purpose, "insurance_upload"),
        isNull(tokenLinks.consumedAt),
        gt(tokenLinks.expiresAt, now),
      ),
    );

  const tokenLink = await tx
    .insert(tokenLinks)
    .values({
      enrollmentId: input.enrollmentId,
      purpose: "insurance_upload",
      tokenHash: hashToken(rawToken),
      recipientEmail: normalizedRecipientEmail,
      expiresAt,
    })
    .returning();

  return {
    token: rawToken,
    expiresAt,
    tokenLinkId: tokenLink[0].id,
  };
}

export async function getInsuranceUploadTokenRecord(rawToken: string) {
  return db.query.tokenLinks.findFirst({
    where: and(
      eq(tokenLinks.tokenHash, hashToken(rawToken)),
      eq(tokenLinks.purpose, "insurance_upload"),
    ),
    orderBy: [desc(tokenLinks.createdAt)],
  });
}

export async function uploadInsuranceArtifact(input: {
  rawToken: string;
  file: File;
  ipAddress?: string | null;
}) {
  if (!allowedInsuranceMimeTypes.has(input.file.type)) {
    throw new Error("Insurance upload must be a PDF or image file");
  }

  if (input.file.size <= 0 || input.file.size > maxInsuranceUploadBytes) {
    throw new Error("Insurance upload must be between 1 byte and 10 MB");
  }

  const token = await getInsuranceUploadTokenRecord(input.rawToken);

  if (!token || token.purpose !== "insurance_upload" || !token.enrollmentId) {
    throw new Error("Invalid insurance upload token");
  }

  const enrollmentId = token.enrollmentId;

  const now = new Date();

  if (token.consumedAt) {
    throw new Error("Insurance upload token already used");
  }

  if (token.expiresAt < now) {
    throw new Error("Insurance upload token expired");
  }

  const filename = sanitizeFilename(input.file.name || "insurance-card");
  const storagePath = `enrollments/${enrollmentId}/insurance/${Date.now()}-${filename}`;
  const fileBody = await input.file.arrayBuffer();
  const uploaded = await uploadPrivateArtifact({
    path: storagePath,
    body: fileBody,
    contentType: input.file.type,
  });

  return db.transaction(async (tx) => {
    const consumed = await tx
      .update(tokenLinks)
      .set({
        consumedAt: now,
        consumedByIp: input.ipAddress ?? null,
        updatedAt: now,
      })
      .where(
        and(
          eq(tokenLinks.id, token.id),
          isNull(tokenLinks.consumedAt),
          gt(tokenLinks.expiresAt, now),
        ),
      )
      .returning();

    if (!consumed[0]) {
      throw new Error("Insurance upload token expired");
    }

    const packet = await tx.query.documentPackets.findFirst({
      where: and(
        eq(documentPackets.enrollmentId, enrollmentId),
        eq(documentPackets.isCurrent, true),
      ),
      orderBy: [desc(documentPackets.createdAt)],
    });

    const artifact = await tx
      .insert(fileArtifacts)
      .values({
        enrollmentId,
        packetId: packet?.id ?? null,
        artifactType: "insurance_card",
        storageBucket: uploaded.bucket,
        storagePath: uploaded.path,
        sourceProvider: "internal",
        originalFilename: filename,
        mimeType: input.file.type,
        sizeBytes: input.file.size,
        externalReference: null,
      })
      .returning();

    if (packet) {
      await tx
        .update(documentPackets)
        .set({
          insuranceArtifactId: artifact[0].id,
          updatedAt: now,
        })
        .where(eq(documentPackets.id, packet.id));
    }

    await tx
      .update(enrollments)
      .set({
        insuranceUploadedAt: now,
        updatedAt: now,
      })
      .where(eq(enrollments.id, enrollmentId));

    await recordAuditEvent({
      actorType: "external",
      actorDisplay: token.recipientEmail,
      action: "insurance.uploaded",
      enrollmentId,
      metadata: {
        filename,
        mimeType: input.file.type,
        sizeBytes: input.file.size,
      },
      executor: tx,
    });

    return artifact[0];
  }).finally(async () => {
    await refreshEnrollmentReadiness(enrollmentId);
  });
}
