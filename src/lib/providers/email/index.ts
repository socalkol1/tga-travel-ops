import { env } from "@/lib/env/server";
import { FakeEmailProvider } from "@/lib/providers/email/fake";
import { ResendEmailProvider } from "@/lib/providers/email/resend";

export function getEmailProvider() {
  return env.EMAIL_PROVIDER === "resend"
    ? new ResendEmailProvider()
    : new FakeEmailProvider();
}
