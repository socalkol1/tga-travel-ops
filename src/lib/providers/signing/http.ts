import { env } from "@/lib/env/server";
import { tokensEqual } from "@/lib/security/tokens";
import type {
  CompletedDocumentReference,
  CreateSigningPacketInput,
  CreateSigningPacketResult,
  SigningProvider,
  SigningWebhookEvent,
} from "@/lib/providers/signing/types";

type DocumensoTemplateRecipient = {
  id: number;
  role?: string;
  signingOrder?: number;
};

type DocumensoTemplate = {
  id: number;
  recipients?: DocumensoTemplateRecipient[];
};

type DocumensoTemplateUseResponse = {
  id: string;
  status?: string;
  recipients?: Array<{
    id: number;
    email: string;
    name?: string | null;
    signingUrl?: string;
  }>;
};

type DocumensoEnvelope = {
  id: string;
  status?: string;
};

type DocumensoWebhookPayload = {
  event?: string;
  createdAt?: string;
  payload?: {
    id?: string | number;
    completedAt?: string | null;
    updatedAt?: string | null;
    createdAt?: string | null;
    rejectionReason?: string | null;
    reason?: string | null;
  };
};

const trackedWebhookEvents = new Map<string, SigningWebhookEvent["type"]>([
  ["DOCUMENT_OPENED", "document.opened"],
  ["DOCUMENT_COMPLETED", "document.completed"],
  ["DOCUMENT_REJECTED", "document.rejected"],
  ["DOCUMENT_CANCELLED", "document.cancelled"],
]);

export class HttpDocumensoSigningProvider implements SigningProvider {
  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${env.SIGNING_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: env.SIGNING_API_TOKEN,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Documenso request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private pickPrimaryRecipient(template: DocumensoTemplate) {
    const recipients = template.recipients ?? [];

    const primarySigner = recipients
      .filter((recipient) => !recipient.role || recipient.role === "SIGNER")
      .sort((left, right) => (left.signingOrder ?? 0) - (right.signingOrder ?? 0))[0];

    if (!primarySigner) {
      throw new Error("Documenso template has no signer recipient");
    }

    return primarySigner;
  }

  async createDocumentFromTemplate(input: CreateSigningPacketInput): Promise<CreateSigningPacketResult> {
    const template = await this.fetchJson<DocumensoTemplate>(`/template/${input.templateId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const recipient = this.pickPrimaryRecipient(template);
    const recipientEmail = input.alternateSignerEmail?.trim() || input.guardianEmail.trim();
    const recipientName = input.guardianName.trim();

    const document = await this.fetchJson<DocumensoTemplateUseResponse>("/template/use", {
      method: "POST",
      body: JSON.stringify({
        templateId: Number.isNaN(Number(input.templateId)) ? input.templateId : Number(input.templateId),
        recipients: [
          {
            id: recipient.id,
            email: recipientEmail,
            name: recipientName,
          },
        ],
        distributeDocument: true,
        externalId: input.enrollmentId,
        override: {
          subject: `Travel packet for ${input.participantName}`,
          message: `Please review and sign the travel packet for ${input.participantName}.`,
        },
      }),
    });

    const signingRecipient = document.recipients?.find((item) => item.email === recipientEmail)
      ?? document.recipients?.[0];

    return {
      documentId: String(document.id),
      status: document.status === "REJECTED" ? "failed" : "sent",
      signingUrl: signingRecipient?.signingUrl,
    };
  }

  async resendDocument(documentId: string) {
    await this.fetchJson("/envelope/distribute", {
      method: "POST",
      body: JSON.stringify({
        envelopeId: documentId,
      }),
    });
  }

  async validateWebhook(headers: Headers, rawBody: string) {
    void rawBody;

    if (!env.SIGNING_WEBHOOK_SECRET) {
      return false;
    }

    const secret = headers.get("x-documenso-secret");

    if (!secret) {
      return false;
    }

    return tokensEqual(secret, env.SIGNING_WEBHOOK_SECRET);
  }

  async parseWebhook(rawBody: string): Promise<SigningWebhookEvent | null> {
    const payload = JSON.parse(rawBody) as DocumensoWebhookPayload;
    const rawEvent = payload.event?.trim();
    const mappedType = rawEvent ? trackedWebhookEvents.get(rawEvent) : undefined;

    if (!mappedType) {
      return null;
    }

    const documentId = String(payload.payload?.id ?? "");

    if (!documentId) {
      throw new Error("Documenso webhook missing document id");
    }

    const occurredAt = payload.payload?.completedAt
      ?? payload.createdAt
      ?? payload.payload?.updatedAt
      ?? payload.payload?.createdAt
      ?? new Date().toISOString();

    const eventId = `${rawEvent}:${documentId}:${payload.createdAt ?? occurredAt}`;

    if (mappedType === "document.rejected" || mappedType === "document.cancelled") {
      return {
        eventId,
        type: mappedType,
        documentId,
        occurredAt,
        reason: payload.payload?.rejectionReason ?? payload.payload?.reason ?? null,
      };
    }

    return {
      eventId,
      type: mappedType,
      documentId,
      occurredAt,
    };
  }

  async getCompletedDocumentReference(documentId: string): Promise<CompletedDocumentReference> {
    const document = await this.fetchJson<DocumensoEnvelope>(`/envelope/${documentId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    return {
      documentId: String(document.id),
      externalReference: String(document.id),
    };
  }
}
