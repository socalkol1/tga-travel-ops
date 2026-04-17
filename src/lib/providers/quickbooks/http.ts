import { createHmac, timingSafeEqual } from "crypto";

import { env } from "@/lib/env/server";
import type {
  CustomerInput,
  InvoiceInput,
  InvoiceStatusResult,
  QuickBooksProvider,
  QuickBooksWebhookEvent,
} from "@/lib/providers/quickbooks/types";

export class HttpQuickBooksProvider implements QuickBooksProvider {
  async findOrCreateCustomer(input: CustomerInput) {
    return {
      customerId: `qbo-customer-${input.guardianEmail.toLowerCase()}`,
    };
  }

  async createInvoice(input: InvoiceInput): Promise<InvoiceStatusResult> {
    return {
      invoiceId: `qbo-invoice-${input.enrollmentId}`,
      invoiceNumber: `INV-${input.enrollmentId.slice(0, 8).toUpperCase()}`,
      status: "open",
      amountCents: input.amountCents,
      balanceCents: input.amountCents,
    };
  }

  async fetchInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResult> {
    return {
      invoiceId,
      invoiceNumber: invoiceId.toUpperCase(),
      status: "open",
      amountCents: 0,
      balanceCents: 0,
    };
  }

  async validateWebhook(headers: Headers, rawBody: string) {
    if (!env.QUICKBOOKS_WEBHOOK_VERIFIER) {
      return false;
    }

    const signature = headers.get("intuit-signature");

    if (!signature) {
      return false;
    }

    const digest = createHmac("sha256", env.QUICKBOOKS_WEBHOOK_VERIFIER)
      .update(rawBody)
      .digest("base64");

    const signatureBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);

    if (signatureBuffer.length !== digestBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, digestBuffer);
  }

  async parseWebhook(rawBody: string) {
    return JSON.parse(rawBody) as QuickBooksWebhookEvent;
  }
}
