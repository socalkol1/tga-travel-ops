import { createHash } from "crypto";

import type {
  CustomerInput,
  InvoiceInput,
  InvoiceStatusResult,
  QuickBooksProvider,
  QuickBooksWebhookEvent,
} from "@/lib/providers/quickbooks/types";

export class FakeQuickBooksProvider implements QuickBooksProvider {
  async findOrCreateCustomer(input: CustomerInput) {
    return {
      customerId: `fake-customer-${createHash("md5").update(JSON.stringify(input)).digest("hex").slice(0, 10)}`,
    };
  }

  async createInvoice(input: InvoiceInput): Promise<InvoiceStatusResult> {
    const id = `fake-invoice-${createHash("md5").update(JSON.stringify(input)).digest("hex").slice(0, 10)}`;

    return {
      invoiceId: id,
      invoiceNumber: id.replace("fake-", "").toUpperCase(),
      status: "open",
      amountCents: input.amountCents,
      balanceCents: input.amountCents,
      invoiceUrl: `https://fake-qbo.local/invoices/${id}`,
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

  async validateWebhook() {
    return true;
  }

  async parseWebhook(rawBody: string): Promise<QuickBooksWebhookEvent> {
    return JSON.parse(rawBody) as QuickBooksWebhookEvent;
  }
}
