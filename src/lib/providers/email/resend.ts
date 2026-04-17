import { Resend } from "resend";

import { env } from "@/lib/env/server";
import type { EmailProvider, SendEmailInput } from "@/lib/providers/email/types";

export class ResendEmailProvider implements EmailProvider {
  private client = new Resend(env.RESEND_API_KEY);

  async send(input: SendEmailInput) {
    const response = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return { id: response.data?.id ?? "unknown" };
  }
}
