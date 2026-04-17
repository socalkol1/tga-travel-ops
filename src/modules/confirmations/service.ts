import { addHours } from "date-fns";
import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { db, type Transaction } from "@/lib/db/client";
import { confirmationRequests, enrollments, tokenLinks } from "@/lib/db/schema";
import { env } from "@/lib/env/server";
import { hashToken, generateOpaqueToken } from "@/lib/security/tokens";
import { recordAuditEvent } from "@/modules/audit/service";
import { enqueueJob } from "@/modules/jobs/service";

type ConfirmationActor = { id?: string; display: string; type: string };

export async function issueConfirmationRequestTx(
  tx: Transaction,
  input: {
    enrollmentId: string;
    recipientEmail: string;
    actor: ConfirmationActor;
  },
) {
  const now = new Date();
  const normalizedRecipientEmail = input.recipientEmail.trim().toLowerCase();
  const rawToken = generateOpaqueToken();
  const expiresAt = addHours(now, env.TOKEN_TTL_HOURS);

  await tx
    .update(tokenLinks)
    .set({
      expiresAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(tokenLinks.enrollmentId, input.enrollmentId),
        eq(tokenLinks.purpose, "confirmation"),
        isNull(tokenLinks.consumedAt),
        gt(tokenLinks.expiresAt, now),
      ),
    );

  const tokenLink = await tx
    .insert(tokenLinks)
    .values({
      enrollmentId: input.enrollmentId,
      purpose: "confirmation",
      tokenHash: hashToken(rawToken),
      recipientEmail: normalizedRecipientEmail,
      expiresAt,
    })
    .returning();

  await tx.insert(confirmationRequests).values({
    enrollmentId: input.enrollmentId,
    tokenLinkId: tokenLink[0].id,
    recipientEmail: normalizedRecipientEmail,
    sentAt: now,
  });

  await tx
    .update(enrollments)
    .set({
      confirmationStatus: "sent",
      confirmationDueAt: expiresAt,
      updatedAt: now,
    })
    .where(eq(enrollments.id, input.enrollmentId));

  await enqueueJob({
    type: "send_confirmation_email",
    payload: {
      enrollmentId: input.enrollmentId,
      recipientEmail: normalizedRecipientEmail,
      token: rawToken,
    },
    idempotencyKey: `confirmation-email:${tokenLink[0].id}`,
    executor: tx,
  });

  await recordAuditEvent({
    actorType: input.actor.type,
    actorId: input.actor.id,
    actorDisplay: input.actor.display,
    action: "confirmation.requested",
    enrollmentId: input.enrollmentId,
    metadata: {
      recipientEmail: normalizedRecipientEmail,
      expiresAt: expiresAt.toISOString(),
    },
    executor: tx,
  });

  return {
    token: rawToken,
    expiresAt,
  };
}

export async function issueConfirmationRequest(input: {
  enrollmentId: string;
  recipientEmail: string;
  actor: ConfirmationActor;
}) {
  return db.transaction(async (tx) => issueConfirmationRequestTx(tx, input));
}

export async function consumeConfirmationToken(input: {
  rawToken: string;
  ipAddress?: string | null;
  actorDisplay: string;
}) {
  const tokenHash = hashToken(input.rawToken);
  const token = await db.query.tokenLinks.findFirst({
    where: eq(tokenLinks.tokenHash, tokenHash),
    orderBy: [desc(tokenLinks.createdAt)],
  });

  if (!token || token.purpose !== "confirmation") {
    throw new Error("Invalid confirmation token");
  }

  const now = new Date();

  if (token.consumedAt) {
    throw new Error("Confirmation token already used");
  }

  if (token.expiresAt < now) {
    throw new Error("Confirmation token expired");
  }

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
      if (token.consumedAt) {
        throw new Error("Confirmation token already used");
      }

      throw new Error("Confirmation token expired");
    }

    await tx
      .update(confirmationRequests)
      .set({
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(confirmationRequests.tokenLinkId, token.id));

    await tx
      .update(enrollments)
      .set({
        enrollmentStatus: "confirmed",
        confirmationStatus: "confirmed",
        confirmedAt: now,
        updatedAt: now,
      })
      .where(eq(enrollments.id, token.enrollmentId!));

    await enqueueJob({
      type: "create_signing_packet",
      payload: { enrollmentId: token.enrollmentId },
      idempotencyKey: `packet:${token.enrollmentId}`,
      executor: tx,
    });

    await enqueueJob({
      type: "create_quickbooks_invoice",
      payload: { enrollmentId: token.enrollmentId },
      idempotencyKey: `invoice:${token.enrollmentId}`,
      executor: tx,
    });

    await recordAuditEvent({
      actorType: "external",
      actorDisplay: input.actorDisplay,
      action: "confirmation.completed",
      enrollmentId: token.enrollmentId,
      executor: tx,
    });

    return consumed[0];
  });
}

export async function getLatestConfirmationRequest(enrollmentId: string) {
  return db.query.confirmationRequests.findFirst({
    where: eq(confirmationRequests.enrollmentId, enrollmentId),
    orderBy: [desc(confirmationRequests.createdAt)],
  });
}

export async function getConfirmationTokenRecord(rawToken: string) {
  return db.query.tokenLinks.findFirst({
    where: and(eq(tokenLinks.tokenHash, hashToken(rawToken)), eq(tokenLinks.purpose, "confirmation")),
  });
}
