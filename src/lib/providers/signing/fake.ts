import { createHash } from "crypto";

import type {
  CompletedDocumentReference,
  CreateSigningPacketInput,
  CreateSigningPacketResult,
  SigningProvider,
  SigningWebhookEvent,
} from "@/lib/providers/signing/types";

export class FakeSigningProvider implements SigningProvider {
  async createDocumentFromTemplate(input: CreateSigningPacketInput): Promise<CreateSigningPacketResult> {
    return {
      documentId: `fake-signing-${createHash("md5").update(JSON.stringify(input)).digest("hex").slice(0, 12)}`,
      status: "sent",
      signingUrl: `https://fake-signing.local/documents/${input.enrollmentId}`,
    };
  }

  async resendDocument() {
    return;
  }

  async validateWebhook() {
    return true;
  }

  async parseWebhook(rawBody: string): Promise<SigningWebhookEvent | null> {
    return JSON.parse(rawBody) as SigningWebhookEvent;
  }

  async getCompletedDocumentReference(documentId: string): Promise<CompletedDocumentReference> {
    return {
      documentId,
      externalReference: documentId,
    };
  }
}
