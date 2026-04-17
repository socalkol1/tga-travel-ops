# TGA Travel Operations

Production-minded v1 internal operations app for nonprofit wrestler travel workflows.

## What this app does

- Public trip applications without external accounts
- Staff authentication with Google Workspace SSO via Auth.js
- Trip configuration, participant/guardian records, and enrollment workflow tracking
- Secure confirmation links for guardian or alternate confirmer flows
- DocuSeal packet orchestration for signatures and insurance-card collection
- QuickBooks invoice orchestration and payment-status reconciliation
- Postgres-backed jobs/outbox processing with Vercel Cron
- Staff dashboard, ops queue, audit trail, reminders, and readiness tracking

## Architecture summary

- App runtime: Next.js App Router + TypeScript + Tailwind
- Database: Supabase Postgres with Drizzle schema/migrations
- Storage: Supabase Storage reserved for future artifact storage; current artifact metadata is tracked in Postgres
- Auth: Auth.js with Google provider and optional local dev credentials fallback
- Integrations: DocuSeal, QuickBooks Online, Resend via provider abstractions with fake providers for dev/test
- Async model: Postgres jobs/outbox table processed by cron-safe workers using `FOR UPDATE SKIP LOCKED`
- Observability: health endpoint, structured logs, ops queue, Sentry wiring points

## Quick start

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, and `CRON_SHARED_SECRET`.
3. Keep `DOCUSEAL_PROVIDER=fake`, `QUICKBOOKS_PROVIDER=fake`, and `EMAIL_PROVIDER=fake` for local development unless you have credentials.
4. Generate migrations if you modify the schema:
   - `npm run db:generate`
5. Apply migrations against your Postgres database.
6. Seed a demo trip:
   - `npm run seed`
7. Start the app:
   - `npm run dev`

## Scripts

- `npm run dev`: local development server
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript strict checks
- `npm test`: unit + integration tests
- `npm run test:e2e`: Playwright smoke tests
- `npm run db:generate`: generate SQL migration from Drizzle schema
- `npm run seed`: insert a demo trip and local owner user

## Credentials still needed for full production wiring

- Google OAuth client ID/secret
- Supabase project URL + service role key
- DocuSeal API key + webhook secret
- QuickBooks app credentials + realm ID + webhook verifier
- Resend API key
- Sentry DSN

## Google OAuth setup

- Set `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET`, and `AUTH_URL`.
- Add `${AUTH_URL}/api/auth/callback/google` to the Google OAuth redirect URIs.
- Set either `AUTH_ALLOWED_DOMAIN` or `AUTH_ALLOWED_EMAILS` so only staff accounts can complete sign-in.

## Docs

- Architecture overview: `docs/architecture/overview.md`
- Data model: `docs/architecture/data-model.md`
- Integrations: `docs/architecture/integrations.md`
- Testing strategy: `docs/architecture/testing-strategy.md`
- Deployment: `docs/runbooks/deploy.md`
- Common failures: `docs/runbooks/common-failures.md`
- Backups and recovery: `docs/runbooks/backups-and-recovery.md`
- ADRs: `docs/adr/*`

## Current implementation status

The repo contains the working v1 foundation:

- Schema and migration generated
- Public application and confirmation routes
- Staff dashboard, trips view, enrollment detail, ops page
- Jobs/outbox service and cron endpoint
- Fake providers and webhook ingestion
- Core unit/integration tests

Live provider credentials, Supabase project resources, and production environment configuration still need to be supplied before a real deployment.
