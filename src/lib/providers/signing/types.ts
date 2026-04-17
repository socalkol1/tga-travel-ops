export type CreateSigningPacketInput = {
  enrollmentId: string;
  templateId: string;
  participantName: string;
  guardianName: string;
  guardianEmail: string;
  alternateSignerEmail?: string | null;
};

export type CreateSigningPacketResult = {
  documentId: string;
  status: "sent" | "failed";
  signingUrl?: string;
};

export type CompletedDocumentReference = {
  documentId: string;
  externalReference: string;
};

export type SigningWebhookEvent =
  | {
      eventId: string;
      type: "document.opened";
      documentId: string;
      occurredAt: string;
    }
  | {
      eventId: string;
      type: "document.completed";
      documentId: string;
      occurredAt: string;
    }
  | {
      eventId: string;
      type: "document.rejected";
      documentId: string;
      occurredAt: string;
      reason?: string | null;
    }
  | {
      eventId: string;
      type: "document.cancelled";
      documentId: string;
      occurredAt: string;
      reason?: string | null;
    };

export interface SigningProvider {
  createDocumentFromTemplate(input: CreateSigningPacketInput): Promise<CreateSigningPacketResult>;
  resendDocument(documentId: string): Promise<void>;
  validateWebhook(headers: Headers, rawBody: string): Promise<boolean>;
  parseWebhook(rawBody: string): Promise<SigningWebhookEvent | null>;
  getCompletedDocumentReference(documentId: string): Promise<CompletedDocumentReference>;
}
