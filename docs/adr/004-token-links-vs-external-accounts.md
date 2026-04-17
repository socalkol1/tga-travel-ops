# ADR 004: Signed Token Links Instead Of External Accounts

## Decision

Use expiring signed token links for external confirmation flows.

## Why

- Lower friction for parents/guardians
- Less support burden than password resets and account management
- Better fit for low-volume, episodic interactions

## Consequences

- Tokens require strict expiry, hashing, and audit logging
- Staff need resend and override tools
