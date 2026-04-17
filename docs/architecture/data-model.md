# Data Model

## Core tables

- `staff_users`: internal staff identities and RBAC role
- `trips`: trip configuration, deadlines, pricing, packet template mapping
- `participants`: traveler records
- `guardians`: billing/contact records
- `enrollments`: central workflow record with separate status dimensions
- `token_links`: hashed signed-link token storage with purpose and expiry
- `confirmation_requests`: sent/completed confirmation lifecycle
- `document_packets`: DocuSeal packet execution state
- `billing_records`: QuickBooks invoice/customer linkage and billing status
- `file_artifacts`: provider/reference metadata for insurance cards and signed packets
- `reminder_sends`: reminder history and dedupe
- `enrollment_notes`: staff notes
- `audit_events`: operational timeline
- `external_webhook_events`: raw webhook payloads plus processing status
- `jobs`: Postgres-backed outbox/worker queue

## Status dimensions

Separate status fields are intentional:

- `enrollment_status`
- `confirmation_status`
- `packet_status`
- `billing_status`
- `readiness_status`

This keeps each workflow dimension queryable and avoids a single mega-enum that mixes unrelated business concerns.

## Readiness model

Readiness is derived from:

- confirmation complete
- packet complete
- insurance artifact present
- invoice paid
- manual override
- exception/block state

The derived result is stored on the enrollment for dashboard efficiency and recalculated after major workflow events.

## Token model

- Tokens are generated opaque values
- Only SHA-256 hashes are stored
- Each token has a `purpose`
- Each token has `expires_at` and `consumed_at`
- Audit events record issue and use

## Why participants and guardians are split

- Guardians are communication and billing contacts
- Participants are the travelers
- Future trips may reuse guardian/participant data independently
- Board NDA workflows can later reuse the token/document patterns without forcing the same person model
