export type EmailTemplate =
  | "application_receipt"
  | "confirmation_request"
  | "documents_sent"
  | "reminder"
  | "invoice_status";

export type SendEmailInput = {
  to: string;
  subject: string;
  template: EmailTemplate;
  text: string;
  html?: string;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<{ id: string }>;
}
