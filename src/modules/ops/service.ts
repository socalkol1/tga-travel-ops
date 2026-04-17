import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { listFailedJobs } from "@/modules/jobs/service";
import { listFailedWebhookEvents } from "@/modules/webhooks/service";

export async function getDashboardSummary() {
  const counts = await db.execute(sql`
    select
      count(*) filter (where enrollment_status = 'applied') as applied,
      count(*) filter (where enrollment_status = 'awaiting_review') as awaiting_review,
      count(*) filter (where confirmation_status in ('pending', 'sent')) as awaiting_confirmation,
      count(*) filter (where enrollment_status = 'confirmed') as confirmed,
      count(*) filter (where packet_status in ('not_started', 'sent', 'viewed')) as docs_pending,
      count(*) filter (where packet_status = 'completed') as docs_completed,
      count(*) filter (where billing_status in ('open', 'partially_paid')) as invoice_open,
      count(*) filter (where billing_status = 'paid') as invoice_paid,
      count(*) filter (where readiness_status = 'ready') as ready_for_travel,
      count(*) filter (where readiness_status in ('blocked', 'exception')) as blocked
    from enrollments
  `);

  const [failedJobs, failedWebhooks] = await Promise.all([
    listFailedJobs(),
    listFailedWebhookEvents(),
  ]);

  return {
    counts: (Array.from(counts)[0] ?? {}) as Record<string, string>,
    failedJobs,
    failedWebhooks,
  };
}
