# Architecture Overview

## Goals

- One internal operational source of truth
- Minimal ops burden for a small nonprofit
- Clean extension path for future trips and adjacent workflows such as board NDAs
- Reliable external side effects without heavyweight orchestration infrastructure

## High-level design

- Next.js modular monolith on Vercel
- Supabase Postgres as system of record
- Supabase Storage reserved for future artifact storage
- Auth.js for staff auth
- Signed token links for external confirmation flows
- DocuSeal for signature execution and insurance upload
- QuickBooks as billing/payment truth
- Resend for transactional email

## Application boundaries

Internal app owns:

- trips
- participants and guardians
- enrollments and workflow state
- readiness calculation
- reminders
- audit trail
- failed jobs and webhook visibility
- permissions and manual overrides

External systems own:

- DocuSeal: e-sign execution and signer interactions
- QuickBooks: accounting and invoice/payment truth
- Resend: mail transport

## Async architecture

- Public/webhook routes stay thin
- Only validated webhook payloads are persisted, then processed asynchronously
- External side effects are initiated by jobs, not inline request handlers
- Job workers use Postgres row locking with `FOR UPDATE SKIP LOCKED`
- Retry/backoff and dead-letter state live in the `jobs` table
- Vercel Cron hits a single worker endpoint hourly in v1

## Why this is intentionally boring

- No microservices
- No Redis/SQS/Kafka/Temporal
- No custom signature engine
- No custom accounting state machine separate from provider truth
- Minimal infrastructure surface area for a future solo maintainer
