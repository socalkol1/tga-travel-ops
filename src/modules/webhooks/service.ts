import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { externalWebhookEvents } from "@/lib/db/schema";
import { enqueueJob } from "@/modules/jobs/service";

function normalizeExternalEventId(eventId?: string | null) {
  const normalized = eventId?.trim();
  return normalized ? normalized : null;
}

export async function persistValidatedWebhookEvent(input: {
  provider: "documenso" | "quickbooks";
  externalEventId?: string | null;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
}) {
  const externalEventId = normalizeExternalEventId(input.externalEventId);
  const existing =
    externalEventId
      ? await db.query.externalWebhookEvents.findFirst({
          where: and(
            eq(externalWebhookEvents.provider, input.provider),
            eq(externalWebhookEvents.externalEventId, externalEventId),
          ),
        })
      : null;

  if (existing) {
    return existing;
  }

  const inserted = await db
    .insert(externalWebhookEvents)
    .values({
      provider: input.provider,
      externalEventId,
      signatureValid: true,
      payload: input.payload,
      headers: input.headers,
    })
    .returning();

  await enqueueJob({
    type:
      input.provider === "documenso"
        ? "process_signing_webhook"
        : "process_quickbooks_webhook",
    payload: {
      webhookEventId: inserted[0].id,
    },
    idempotencyKey: `webhook:${input.provider}:${inserted[0].id}`,
  });

  return inserted[0];
}

export async function markWebhookIgnored(id: string, reason = "invalid signature") {
  await db
    .update(externalWebhookEvents)
    .set({
      processingStatus: "ignored",
      processedAt: new Date(),
      updatedAt: new Date(),
      lastError: reason,
    })
    .where(eq(externalWebhookEvents.id, id));
}

export async function markWebhookProcessed(id: string) {
  await db
    .update(externalWebhookEvents)
    .set({
      processingStatus: "processed",
      processedAt: new Date(),
      updatedAt: new Date(),
      lastError: null,
    })
    .where(eq(externalWebhookEvents.id, id));
}

export async function markWebhookFailed(id: string, error: unknown) {
  await db
    .update(externalWebhookEvents)
    .set({
      processingStatus: "failed",
      updatedAt: new Date(),
      lastError: error instanceof Error ? error.message : String(error),
    })
    .where(eq(externalWebhookEvents.id, id));
}

export async function listFailedWebhookEvents() {
  return db.query.externalWebhookEvents.findMany({
    where: eq(externalWebhookEvents.processingStatus, "failed"),
  });
}
