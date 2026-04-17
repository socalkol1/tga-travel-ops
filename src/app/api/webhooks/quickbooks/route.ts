import { NextResponse } from "next/server";

import { env } from "@/lib/env/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getQuickBooksProvider } from "@/lib/providers/quickbooks";
import { persistValidatedWebhookEvent } from "@/modules/webhooks/service";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const rate = consumeRateLimit(
    `webhook:qbo:${ip}`,
    env.RATE_LIMIT_WEBHOOK_REQUESTS_PER_MINUTE,
    60_000,
  );

  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await request.text();
  const provider = getQuickBooksProvider();
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
    provider: "quickbooks",
    externalEventId: typeof payload.eventId === "string" ? payload.eventId : null,
    payload,
    headers: Object.fromEntries(request.headers.entries()),
  });

  return NextResponse.json({ received: true }, { status: 202 });
}
