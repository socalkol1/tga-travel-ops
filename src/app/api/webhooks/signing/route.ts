import { NextResponse } from "next/server";

import { env } from "@/lib/env/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getSigningProvider } from "@/lib/providers/signing";
import { persistValidatedWebhookEvent } from "@/modules/webhooks/service";

function buildExternalEventId(payload: Record<string, unknown>) {
  const event = typeof payload.event === "string" ? payload.event : null;
  const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : null;
  const innerPayload = payload.payload as Record<string, unknown> | undefined;
  const documentId =
    innerPayload && (typeof innerPayload.id === "string" || typeof innerPayload.id === "number")
      ? String(innerPayload.id)
      : null;

  if (!event || !createdAt || !documentId) {
    return null;
  }

  return `${event}:${documentId}:${createdAt}`;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const rate = consumeRateLimit(
    `webhook:signing:${ip}`,
    env.RATE_LIMIT_WEBHOOK_REQUESTS_PER_MINUTE,
    60_000,
  );

  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await request.text();
  const provider = getSigningProvider();
  const signatureValid = await provider.validateWebhook(request.headers, rawBody);

  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
  }

  await persistValidatedWebhookEvent({
    provider: "documenso",
    externalEventId: buildExternalEventId(payload),
    payload,
    headers: Object.fromEntries(request.headers.entries()),
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
