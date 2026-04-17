# Common Failures

## Confirmation email not received

1. Check `jobs` for `send_confirmation_email`.
2. Check `audit_events` for `confirmation.requested`.
3. Confirm token expiry window and recipient email.
4. Retry from the enrollment detail page.

## Packet not created

1. Verify enrollment is confirmed.
2. Check trip has a DocuSeal template ID.
3. Check failed jobs in the ops page.
4. Retry after provider recovery.

## Invoice not created or not updating

1. Check `billing_records` linkage for the enrollment.
2. Check QuickBooks webhook delivery and raw payload storage.
3. Trigger reconciliation or retry invoice creation.
4. Confirm live QuickBooks credentials and realm ID.

## Duplicate webhooks

- Duplicate provider event IDs are rejected at the database layer.
- Inspect `external_webhook_events` before replaying manually.

## Reminder spam concern

- Reminder sends are deduplicated per enrollment/type/day.
- Cadence is trip-configurable.
- Review `reminder_sends` before replaying jobs.
