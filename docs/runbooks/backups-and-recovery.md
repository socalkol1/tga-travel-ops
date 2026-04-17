# Backups And Recovery

## Database

- Rely on Supabase automated backups for managed Postgres
- Enable point-in-time recovery if available on the chosen plan
- Before major schema changes, take a manual backup/export

## Storage

- Signed packet and insurance artifacts should remain recoverable from DocuSeal metadata and provider references
- For high-confidence recovery, add explicit storage mirroring and scheduled inventory exports in a later phase

## Recovery priorities

1. Restore database
2. Validate `enrollments`, `billing_records`, `document_packets`, `audit_events`
3. Replay unprocessed webhook events if needed
4. Re-run invoice reconciliation jobs
5. Re-send confirmation or packet requests only after verifying token/packet state

## Recovery notes

- Workflow truth lives in the internal app, not in spreadsheets
- Accounting truth still comes from QuickBooks, so reconciliation after recovery is mandatory
- Signed documents can be re-linked from DocuSeal metadata if local artifact metadata needs repair
