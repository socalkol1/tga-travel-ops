# ADR 002: Postgres Jobs Instead Of Temporal

## Decision

Use a Postgres-backed jobs/outbox table in v1.

## Why

- The workflow volume is low
- The team does not need Temporal-level orchestration complexity
- Postgres row locking plus retries is enough for webhook processing, reminders, and reconciliation

## Consequences

- Jobs must stay coarse-grained and idempotent
- Long-running workflows should be modeled as state transitions, not worker-held execution
