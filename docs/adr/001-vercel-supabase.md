# ADR 001: Vercel + Supabase

## Decision

Use Vercel for hosting and Supabase for Postgres + Storage in v1.

## Why

- Lowest ops overhead for a small internal tool
- Good fit for Next.js
- Fast path to managed Postgres and private storage
- Easier future handoff than custom AWS infrastructure

## Consequences

- Need cron-safe database locking rather than long-lived workers
- Keep background processing short and idempotent
