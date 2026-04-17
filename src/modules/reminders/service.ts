import { formatISO } from "date-fns";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { reminderSends } from "@/lib/db/schema";
import { getEmailProvider } from "@/lib/providers/email";
import { buildReminderIdempotencyKey, shouldSendReminder } from "@/lib/security/reminders";
import { recordAuditEvent } from "@/modules/audit/service";
import { enqueueJob } from "@/modules/jobs/service";

export async function scheduleReminderSweep() {
  const results = await db.execute(sql`
    select
      e.id as enrollment_id,
      e.confirmation_status,
      e.packet_status,
      e.billing_status,
      e.insurance_uploaded_at,
      e.confirmation_due_at,
      e.docs_due_at,
      e.payment_due_at,
      t.reminder_cadence_hours,
      g.email as guardian_email
    from enrollments e
    join trips t on t.id = e.trip_id
    join guardians g on g.id = e.guardian_id
    where e.enrollment_status not in ('cancelled', 'declined')
  `);

  for (const row of Array.from(results) as Array<Record<string, string | number | null>>) {
    const cadenceHours = Number(row.reminder_cadence_hours ?? 48);
    const enrollmentId = String(row.enrollment_id);
    const guardianEmail = String(row.guardian_email);

    const checks = [
      {
        type: "confirmation_pending" as const,
        isCompleted: row.confirmation_status === "confirmed" || row.confirmation_status === "overridden",
        dueAt: row.confirmation_due_at ? new Date(String(row.confirmation_due_at)) : null,
      },
      {
        type: "docs_pending" as const,
        isCompleted: row.packet_status === "completed" && Boolean(row.insurance_uploaded_at),
        dueAt: row.docs_due_at ? new Date(String(row.docs_due_at)) : null,
      },
      {
        type: "invoice_unpaid" as const,
        isCompleted: row.billing_status === "paid",
        dueAt: row.payment_due_at ? new Date(String(row.payment_due_at)) : null,
      },
    ];

    for (const check of checks) {
      const lastSent = await db.query.reminderSends.findFirst({
        where: sql`${reminderSends.enrollmentId} = ${enrollmentId} and ${reminderSends.reminderType} = ${check.type}`,
        orderBy: [desc(reminderSends.sentAt)],
      });

      const shouldQueue = shouldSendReminder({
        now: new Date(),
        cadenceHours,
        dueAt: check.dueAt,
        lastSentAt: lastSent?.sentAt ?? null,
        isCompleted: check.isCompleted,
      });

      if (!shouldQueue) {
        continue;
      }

      await enqueueJob({
        type: "send_reminder",
        payload: {
          enrollmentId,
          reminderType: check.type,
          recipientEmail: guardianEmail,
        },
        idempotencyKey: `reminder-job:${buildReminderIdempotencyKey({
          enrollmentId,
          type: check.type,
          dayStamp: formatISO(new Date(), { representation: "date" }),
        })}`,
      });
    }
  }
}

export async function sendReminder(input: {
  enrollmentId: string;
  reminderType: "confirmation_pending" | "docs_pending" | "invoice_unpaid";
  recipientEmail: string;
}) {
  const idempotencyKey = buildReminderIdempotencyKey({
    enrollmentId: input.enrollmentId,
    type: input.reminderType,
    dayStamp: formatISO(new Date(), { representation: "date" }),
  });

  const existing = await db.query.reminderSends.findFirst({
    where: eq(reminderSends.idempotencyKey, idempotencyKey),
  });

  if (existing) {
    return existing;
  }

  const details = await db.execute(sql`
    select packet_status, insurance_uploaded_at, confirmation_status, billing_status
    from enrollments
    where id = ${input.enrollmentId}
    limit 1
  `);
  const detail = Array.from(details)[0] as Record<string, string | null> | undefined;
  const docsReminderText =
    detail?.packet_status !== "completed"
      ? "Your signing packet is still waiting to be completed in Documenso."
      : "Your insurance card still needs to be uploaded in TGA.";

  await getEmailProvider().send({
    to: input.recipientEmail,
    subject: "Travel enrollment reminder",
    template: "reminder",
    text:
      input.reminderType === "docs_pending"
        ? docsReminderText
        : `This is a reminder that there is an open item for enrollment ${input.enrollmentId}: ${input.reminderType}.`,
  });

  const reminder = await db
    .insert(reminderSends)
    .values({
      enrollmentId: input.enrollmentId,
      reminderType: input.reminderType,
      recipientEmail: input.recipientEmail,
      idempotencyKey,
    })
    .returning();

  await recordAuditEvent({
    actorType: "system",
    actorDisplay: "System",
    action: "reminder.sent",
    enrollmentId: input.enrollmentId,
    metadata: { type: input.reminderType, recipientEmail: input.recipientEmail },
  });

  return reminder[0];
}
