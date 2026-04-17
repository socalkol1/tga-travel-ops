import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { documentPackets, enrollments, fileArtifacts, guardians, participants, trips } from "@/lib/db/schema";
import { getSigningProvider } from "@/lib/providers/signing";
import type { SigningWebhookEvent } from "@/lib/providers/signing/types";
import { recordAuditEvent } from "@/modules/audit/service";
import { refreshEnrollmentReadiness } from "@/modules/enrollments/service";
import { issueInsuranceUploadTokenTx } from "@/modules/insurance/service";
import { enqueueJob } from "@/modules/jobs/service";

function getSigningTemplateId(trip: typeof trips.$inferSelect | null | undefined) {
  return trip?.signingTemplateId ?? trip?.docusealTemplateId ?? null;
}

async function getCurrentPacketByEnrollmentId(enrollmentId: string) {
  return db.query.documentPackets.findFirst({
    where: and(
      eq(documentPackets.enrollmentId, enrollmentId),
      eq(documentPackets.isCurrent, true),
    ),
    orderBy: [desc(documentPackets.createdAt)],
  });
}

export async function createPacketForEnrollment(
  enrollmentId: string,
  options?: { restartReason?: string | null },
) {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(enrollments.id, enrollmentId),
  });

  if (!enrollment) {
    throw new Error("Enrollment not found");
  }

  const existing = await getCurrentPacketByEnrollmentId(enrollmentId);

  if (existing?.provider === "documenso" && existing.providerSubmissionId) {
    return existing;
  }

  const [trip, guardian, participant] = await Promise.all([
    db.query.trips.findFirst({ where: eq(trips.id, enrollment.tripId) }),
    db.query.guardians.findFirst({ where: eq(guardians.id, enrollment.guardianId) }),
    db.query.participants.findFirst({ where: eq(participants.id, enrollment.participantId) }),
  ]);

  const signingTemplateId = getSigningTemplateId(trip);

  if (!signingTemplateId || !guardian || !participant) {
    throw new Error("Trip template or signer data missing");
  }

  const provider = getSigningProvider();
  const submission = await provider.createDocumentFromTemplate({
    enrollmentId,
    templateId: signingTemplateId,
    participantName: `${participant.firstName} ${participant.lastName}`,
    guardianName: `${guardian.firstName} ${guardian.lastName}`,
    guardianEmail: guardian.email,
    alternateSignerEmail: enrollment.alternateConfirmerEmail,
  });

  const packet = await db.transaction(async (tx) => {
    if (existing) {
      await tx
        .update(documentPackets)
        .set({
          isCurrent: false,
          updatedAt: new Date(),
        })
        .where(eq(documentPackets.id, existing.id));
    }

    const inserted = await tx
      .insert(documentPackets)
      .values({
        enrollmentId,
        provider: "documenso",
        providerSubmissionId: submission.documentId,
        providerTemplateId: signingTemplateId,
        packetStatus: "sent",
        isCurrent: true,
        lastSentAt: new Date(),
      })
      .returning();

    await tx
      .update(enrollments)
      .set({
        packetStatus: "sent",
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, enrollmentId));

    const insuranceToken = await issueInsuranceUploadTokenTx(tx, {
      enrollmentId,
      recipientEmail: enrollment.alternateConfirmerEmail || guardian.email,
    });

    await enqueueJob({
      type: "send_signing_notice_email",
      payload: {
        enrollmentId,
        recipientEmail: enrollment.alternateConfirmerEmail || guardian.email,
        insuranceUploadUrl: `${process.env.AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000"}/insurance/${insuranceToken.token}`,
        signingUrl: submission.signingUrl ?? null,
        reason: options?.restartReason ?? null,
      },
      idempotencyKey: `signing-notice:${insuranceToken.tokenLinkId}`,
      executor: tx,
    });

    await recordAuditEvent({
      actorType: "system",
      actorDisplay: "System",
      action: "packet.sent",
      enrollmentId,
      metadata: {
        provider: "documenso",
        documentId: submission.documentId,
        restartReason: options?.restartReason ?? null,
      },
      executor: tx,
    });

    return inserted[0];
  });

  return packet;
}

export async function resendPacket(enrollmentId: string) {
  const packet = await getCurrentPacketByEnrollmentId(enrollmentId);

  if (!packet?.providerSubmissionId) {
    throw new Error("Packet not found");
  }

  await getSigningProvider().resendDocument(packet.providerSubmissionId);

  await db
    .update(documentPackets)
    .set({
      lastSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(documentPackets.id, packet.id));
}

export async function handleSigningWebhook(event: SigningWebhookEvent) {
  const packet = await db.query.documentPackets.findFirst({
    where: and(
      eq(documentPackets.providerSubmissionId, event.documentId),
      eq(documentPackets.isCurrent, true),
    ),
  });

  if (!packet) {
    return;
  }

  if (event.type === "document.opened") {
    await db
      .update(documentPackets)
      .set({
        packetStatus: "viewed",
        viewedAt: new Date(event.occurredAt),
        updatedAt: new Date(),
      })
      .where(eq(documentPackets.id, packet.id));

    await db
      .update(enrollments)
      .set({
        packetStatus: "viewed",
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, packet.enrollmentId));
  }

  if (event.type === "document.completed") {
    const completedReference = await getSigningProvider().getCompletedDocumentReference(event.documentId);

    const artifact = await db
      .insert(fileArtifacts)
      .values({
        enrollmentId: packet.enrollmentId,
        packetId: packet.id,
        artifactType: "signed_packet",
        storageBucket: "provider-reference",
        storagePath: `documents/${event.documentId}`,
        sourceProvider: "documenso",
        originalFilename: "signed-packet.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
        externalReference: completedReference.externalReference,
      })
      .returning();

    await db
      .update(documentPackets)
      .set({
        packetStatus: "completed",
        completedAt: new Date(event.occurredAt),
        signedPacketArtifactId: artifact[0].id,
        updatedAt: new Date(),
      })
      .where(eq(documentPackets.id, packet.id));

    await db
      .update(enrollments)
      .set({
        packetStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, packet.enrollmentId));
  }

  if (event.type === "document.rejected") {
    await db
      .update(documentPackets)
      .set({
        packetStatus: "rejected",
        lastError: event.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(documentPackets.id, packet.id));

    await db
      .update(enrollments)
      .set({
        packetStatus: "rejected",
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, packet.enrollmentId));
  }

  if (event.type === "document.cancelled") {
    await db
      .update(documentPackets)
      .set({
        packetStatus: "cancelled",
        lastError: event.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(documentPackets.id, packet.id));

    await db
      .update(enrollments)
      .set({
        packetStatus: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, packet.enrollmentId));
  }

  await refreshEnrollmentReadiness(packet.enrollmentId);

  await recordAuditEvent({
    actorType: "system",
    actorDisplay: "Documenso",
    action: `packet.${event.type}`,
    enrollmentId: packet.enrollmentId,
    metadata: event,
  });
}

export async function restartLegacySigningPackets() {
  const restartablePackets = await db.query.documentPackets.findMany({
    where: and(
      eq(documentPackets.isCurrent, true),
      eq(documentPackets.provider, "docuseal"),
      inArray(documentPackets.packetStatus, [
        "not_started",
        "sent",
        "viewed",
        "expired",
        "failed",
      ]),
    ),
  });

  for (const packet of restartablePackets) {
    await db.transaction(async (tx) => {
      await tx
        .update(documentPackets)
        .set({
          isCurrent: false,
          packetStatus: "cancelled",
          lastError: "Superseded by Documenso migration",
          updatedAt: new Date(),
        })
        .where(eq(documentPackets.id, packet.id));

      await tx
        .update(enrollments)
        .set({
          packetStatus: "not_started",
          updatedAt: new Date(),
        })
        .where(eq(enrollments.id, packet.enrollmentId));

      await enqueueJob({
        type: "create_signing_packet",
        payload: {
          enrollmentId: packet.enrollmentId,
          restartReason: "restart",
        },
        idempotencyKey: `packet-restart:${packet.enrollmentId}`,
        executor: tx,
      });

      await recordAuditEvent({
        actorType: "system",
        actorDisplay: "System",
        action: "packet.restart_requested",
        enrollmentId: packet.enrollmentId,
        metadata: {
          supersededPacketId: packet.id,
          priorProvider: packet.provider,
        },
        executor: tx,
      });
    });

    await refreshEnrollmentReadiness(packet.enrollmentId);
  }

  return restartablePackets.length;
}
