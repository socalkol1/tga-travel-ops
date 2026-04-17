import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_TRUST_HOST: z.coerce.boolean().default(true),
  AUTH_GOOGLE_CLIENT_ID: z.string().default(""),
  AUTH_GOOGLE_CLIENT_SECRET: z.string().default(""),
  AUTH_ALLOWED_DOMAIN: z.string().default(""),
  AUTH_ALLOWED_EMAILS: z.string().default(""),
  AUTH_ENABLE_DEV_CREDENTIALS: z.coerce.boolean().default(true),
  AUTH_DEV_USER_EMAIL: z.string().email().default("staff@example.org"),
  AUTH_DEV_USER_NAME: z.string().default("Local Staff"),
  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().default("trip-artifacts"),
  SIGNING_PROVIDER: z.enum(["fake", "documenso"]).default("fake"),
  SIGNING_BASE_URL: z.string().default(""),
  SIGNING_API_TOKEN: z.string().default(""),
  SIGNING_WEBHOOK_SECRET: z.string().default(""),
  QUICKBOOKS_PROVIDER: z.enum(["fake", "quickbooks"]).default("fake"),
  QUICKBOOKS_CLIENT_ID: z.string().default(""),
  QUICKBOOKS_CLIENT_SECRET: z.string().default(""),
  QUICKBOOKS_REALM_ID: z.string().default(""),
  QUICKBOOKS_REDIRECT_URI: z.string().default(""),
  QUICKBOOKS_WEBHOOK_VERIFIER: z.string().default(""),
  EMAIL_PROVIDER: z.enum(["fake", "resend"]).default("fake"),
  EMAIL_FROM: z.string().email().default("ops@example.org"),
  RESEND_API_KEY: z.string().default(""),
  SENTRY_DSN: z.string().default(""),
  CRON_SHARED_SECRET: z.string().min(1, "CRON_SHARED_SECRET is required"),
  RATE_LIMIT_PUBLIC_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WEBHOOK_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(60),
  TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(72),
  DEFAULT_REMINDER_DELAY_HOURS: z.coerce.number().int().positive().default(48),
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
