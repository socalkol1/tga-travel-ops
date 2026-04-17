import { env } from "@/lib/env/server";
import { FakeQuickBooksProvider } from "@/lib/providers/quickbooks/fake";
import { HttpQuickBooksProvider } from "@/lib/providers/quickbooks/http";

export function getQuickBooksProvider() {
  return env.QUICKBOOKS_PROVIDER === "quickbooks"
    ? new HttpQuickBooksProvider()
    : new FakeQuickBooksProvider();
}
