import { describe, expect, it } from "vitest";

import { setupModuleContext } from "../helpers/module-context";

describe("webhook routes", () => {
  it("rejects invalid signing signatures without persisting state", async () => {
    const context = await setupModuleContext({
      SIGNING_PROVIDER: "documenso",
      SIGNING_WEBHOOK_SECRET: "documenso-secret",
    });

    try {
      const { POST } = await import("@/app/api/webhooks/signing/route");
      const body = JSON.stringify({
        event: "DOCUMENT_COMPLETED",
        payload: {
          id: "envelope_invalid",
          completedAt: "2026-04-15T00:00:00.000Z",
        },
        createdAt: "2026-04-15T00:00:00.000Z",
      });

      const response = await POST(new Request("http://localhost/api/webhooks/signing", {
        method: "POST",
        headers: {
          "x-documenso-secret": "invalid-secret",
        },
        body,
      }));

      expect(response.status).toBe(401);
      expect(await context.db.query.externalWebhookEvents.findMany()).toHaveLength(0);
      expect(await context.db.query.jobs.findMany()).toHaveLength(0);
    } finally {
      await context.client.close();
    }
  });

  it("accepts and deduplicates valid signing webhooks", async () => {
    const context = await setupModuleContext({
      SIGNING_PROVIDER: "documenso",
      SIGNING_WEBHOOK_SECRET: "documenso-secret",
    });

    try {
      const { POST } = await import("@/app/api/webhooks/signing/route");
      const payload = {
        event: "DOCUMENT_COMPLETED",
        payload: {
          id: "envelope_valid",
          completedAt: "2026-04-15T00:00:00.000Z",
        },
        createdAt: "2026-04-15T00:00:00.000Z",
      };
      const body = JSON.stringify(payload);

      const request = () =>
        new Request("http://localhost/api/webhooks/signing", {
          method: "POST",
          headers: {
            "x-documenso-secret": "documenso-secret",
          },
          body,
        });

      const first = await POST(request());
      const second = await POST(request());

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const webhookRows = await context.db.query.externalWebhookEvents.findMany();
      const jobRows = await context.db.query.jobs.findMany();

      expect(webhookRows).toHaveLength(1);
      expect(jobRows).toHaveLength(1);
      expect(webhookRows[0]?.signatureValid).toBe(true);
      expect(webhookRows[0]?.externalEventId).toBe("DOCUMENT_COMPLETED:envelope_valid:2026-04-15T00:00:00.000Z");
      expect(jobRows[0]?.type).toBe("process_signing_webhook");
    } finally {
      await context.client.close();
    }
  });

  it("rejects invalid QuickBooks signatures without persisting state", async () => {
    const context = await setupModuleContext({
      QUICKBOOKS_PROVIDER: "quickbooks",
      QUICKBOOKS_WEBHOOK_VERIFIER: "quickbooks-secret",
    });

    try {
      const { POST } = await import("@/app/api/webhooks/quickbooks/route");
      const body = JSON.stringify({
        eventId: "evt_qbo_invalid",
        entityId: "invoice_1",
        type: "invoice.updated",
        occurredAt: "2026-04-15T00:00:00.000Z",
      });

      const response = await POST(new Request("http://localhost/api/webhooks/quickbooks", {
        method: "POST",
        headers: {
          "intuit-signature": "invalid-signature",
        },
        body,
      }));

      expect(response.status).toBe(401);
      expect(await context.db.query.externalWebhookEvents.findMany()).toHaveLength(0);
      expect(await context.db.query.jobs.findMany()).toHaveLength(0);
    } finally {
      await context.client.close();
    }
  });

  it("rejects malformed JSON after a valid signature", async () => {
    const context = await setupModuleContext({
      SIGNING_PROVIDER: "documenso",
      SIGNING_WEBHOOK_SECRET: "documenso-secret",
    });

    try {
      const { POST } = await import("@/app/api/webhooks/signing/route");
      const body = "{not-json";

      const response = await POST(new Request("http://localhost/api/webhooks/signing", {
        method: "POST",
        headers: {
          "x-documenso-secret": "documenso-secret",
        },
        body,
      }));

      expect(response.status).toBe(400);
      expect(await context.db.query.externalWebhookEvents.findMany()).toHaveLength(0);
      expect(await context.db.query.jobs.findMany()).toHaveLength(0);
    } finally {
      await context.client.close();
    }
  });
});
