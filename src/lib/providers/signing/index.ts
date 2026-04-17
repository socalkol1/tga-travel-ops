import { env } from "@/lib/env/server";
import { FakeSigningProvider } from "@/lib/providers/signing/fake";
import { HttpDocumensoSigningProvider } from "@/lib/providers/signing/http";

export function getSigningProvider() {
  return env.SIGNING_PROVIDER === "documenso"
    ? new HttpDocumensoSigningProvider()
    : new FakeSigningProvider();
}
