# Integrations

## DocuSeal

Provider abstraction:

- `createSubmission`
- `resendSubmission`
- `validateWebhook`
- `parseWebhook`

Current approach:

- Trip stores a DocuSeal template reference
- Enrollment confirmation enqueues packet creation
- DocuSeal completion updates packet state and stores insurance/signed artifact metadata references
- Only validated webhook payloads are stored before async processing

Dev/test:

- `FakeDocuSealProvider`
- deterministic fake submission IDs
- direct webhook payload parsing for contract tests

## QuickBooks Online

Provider abstraction:

- `findOrCreateCustomer`
- `createInvoice`
- `fetchInvoiceStatus`
- `validateWebhook`
- `parseWebhook`

Current approach:

- Confirmation enqueues invoice creation
- Billing record stores customer + invoice linkage
- Payment truth is reconciled from QuickBooks
- Open invoices can be re-synced by cron or staff retry

Dev/test:

- `FakeQuickBooksProvider`
- deterministic customer/invoice IDs

## Email

Provider abstraction:

- `send`

Templates currently covered:

- application receipt
- confirmation request
- documents sent
- reminder
- invoice status

Dev/test:

- `FakeEmailProvider`

## Supabase Storage

- Private bucket only
- Reserved for future server-only artifact storage and controlled downloads
- Current provider/reference metadata lives in `file_artifacts`

## Sentry

- Package installed
- runtime integration points reserved
- add DSN and enable environment-specific setup before production cutover
