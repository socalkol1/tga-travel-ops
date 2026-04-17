import { createTestDb } from "./pglite";
import { vi } from "vitest";

const baseEnv = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://local/test",
  AUTH_SECRET: "test-auth-secret",
  CRON_SHARED_SECRET: "test-cron-secret",
  AUTH_ENABLE_DEV_CREDENTIALS: "true",
  AUTH_ALLOWED_DOMAIN: "",
  AUTH_ALLOWED_EMAILS: "",
  SIGNING_PROVIDER: "fake",
  SIGNING_BASE_URL: "https://documenso.example.test/api/v2",
  SIGNING_API_TOKEN: "documenso-api-token",
  SIGNING_WEBHOOK_SECRET: "documenso-webhook-secret",
  QUICKBOOKS_PROVIDER: "fake",
  QUICKBOOKS_CLIENT_ID: "quickbooks-client-id",
  QUICKBOOKS_CLIENT_SECRET: "quickbooks-client-secret",
  QUICKBOOKS_REALM_ID: "realm-id",
  QUICKBOOKS_REDIRECT_URI: "http://localhost:3000/api/quickbooks/callback",
  QUICKBOOKS_WEBHOOK_VERIFIER: "quickbooks-webhook-secret",
  EMAIL_PROVIDER: "fake",
  EMAIL_FROM: "ops@example.org",
  TOKEN_TTL_HOURS: "72",
};

export async function setupModuleContext(
  envOverrides: Record<string, string> = {},
) {
  vi.resetModules();
  vi.doUnmock("@/modules/jobs/service");
  vi.doUnmock("@/lib/auth/auth");
  const context = await createTestDb();

  Object.assign(process.env, baseEnv, envOverrides);

  vi.doMock("@/lib/db/client", () => ({
    db: context.db,
  }));

  return context;
}
