export type CustomerInput = {
  enrollmentId: string;
  guardianName: string;
  guardianEmail: string;
};

export type InvoiceInput = {
  customerId: string;
  enrollmentId: string;
  amountCents: number;
  description: string;
};

export type InvoiceStatusResult = {
  invoiceId: string;
  invoiceNumber: string;
  status: "open" | "partially_paid" | "paid" | "voided";
  amountCents: number;
  balanceCents: number;
  invoiceUrl?: string;
  paidAt?: string | null;
};

export type QuickBooksWebhookEvent = {
  eventId: string;
  entityId: string;
  type: "invoice.updated" | "payment.created";
  occurredAt: string;
};

export interface QuickBooksProvider {
  findOrCreateCustomer(input: CustomerInput): Promise<{ customerId: string }>;
  createInvoice(input: InvoiceInput): Promise<InvoiceStatusResult>;
  fetchInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResult>;
  validateWebhook(headers: Headers, rawBody: string): Promise<boolean>;
  parseWebhook(rawBody: string): Promise<QuickBooksWebhookEvent>;
}
