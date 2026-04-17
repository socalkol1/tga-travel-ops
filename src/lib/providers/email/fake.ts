import type { EmailProvider, SendEmailInput } from "@/lib/providers/email/types";

export class FakeEmailProvider implements EmailProvider {
  async send(input: SendEmailInput) {
    return {
      id: `fake-email-${Buffer.from(`${input.to}:${input.subject}`).toString("hex").slice(0, 16)}`,
    };
  }
}
