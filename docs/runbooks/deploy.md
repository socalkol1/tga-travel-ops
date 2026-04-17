# Deploy

## Stack

- Vercel for app hosting
- Supabase for Postgres and Storage

## Environments

- Local
- Staging
- Production

Use separate:

- database
- storage bucket namespace
- OAuth credentials
- webhook URLs
- email sender domains where required

## Deployment steps

1. Provision Supabase project and database.
2. Apply generated SQL migration from `drizzle/`.
3. Create private storage bucket.
4. Configure Vercel environment variables from `.env.example`.
5. Enable Google OAuth callback URLs for staging/production.
6. Configure DocuSeal and QuickBooks webhooks to the deployed URLs.
7. Deploy to Vercel.
8. Verify `/api/health`.
9. Trigger `/api/cron/process-jobs` with the cron bearer secret or let Vercel Cron start it.
10. Seed initial staff/trips if needed.

## Production checklist

- Auth allowlist/domain configured
- Cron secret configured
- Storage bucket private
- Fake providers disabled
- Sentry DSN configured
- Health check monitored
- At least one owner-role user present
- Trip template mappings verified
