# Testing Strategy

## Unit tests

Cover pure workflow logic:

- readiness calculation
- token helper behavior
- reminder cadence decisions
- idempotency key behavior

## Integration tests

Use fake providers and an ephemeral PGlite-backed database to verify:

- schema integrity
- relational inserts across trips/guardians/participants/enrollments
- unique idempotency constraints
- duplicate webhook rejection
- provider contracts

## End-to-end tests

Playwright is configured and includes a smoke test. Expand it in staging/local Supabase environments to cover:

- public application submission
- alternate confirmer flow
- packet creation
- fake DocuSeal completion
- fake QuickBooks payment update
- dashboard readiness state

## Why e2e is intentionally light in this repo snapshot

Full browser-flow automation needs a running local Postgres/Supabase environment plus seeded data. The harness is configured, but richer e2e coverage should be run in a provisioned local or staging environment rather than faking the database in-browser.
