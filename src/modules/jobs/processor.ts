import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { externalWebhookEvents } from "@/lib/db/schema";
import { getEmailProvider } from "@/lib/providers/email";
import { getSigningProvider } from "@/lib/providers/signing";
import { getQuickBooksProvider } from "@/lib/providers/quickbooks";
import { logger } from "@/lib/logging/logger";
import { createInvoiceForEnrollment, syncInvoiceStatus, handleQuickBooksWebhook } from "@/modules/billing/service";
import { createPacketForEnrollment, handleSigningWebhook } from "@/modules/documents/service";
import { markEnrollmentException } from "@/modules/enrollments/service";
import { claimDueJobs, markJobComplete, markJobFailed } from "@/modules/jobs/service";
import { sendReminder, scheduleReminderSweep } from "@/modules/reminders/service";
import { markWebhookFailed, markWebhookIgnored, markWebhookProcessed } from "@/modules/webhooks/service";

export async function processDueJobs(options?: { limit?: number; workerId?: string }) {
  const limit = options?.limit ?? 25;
  const workerId = options?.workerId ?? `worker-${Date.now()}`;
  const jobs = await claimDueJobs(limit, workerId);

  for (const job of jobs) {
    try {
      await processSingleJob(job);
      await markJobComplete(job.id);
    } catch (error) {
      logger.error({ err: error, jobId: job.id, jobType: job.type }, "Job processing failed");
      await markJobFailed(job, error);
    }
  }

  return jobs.length;
}

async function processSingleJob(job: {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}) {
  switch (job.type) {
    case "send_application_receipt": {
      await getEmailProvider().send({
        to: String(job.payload.recipientEmail),
        subject: "We received your travel application",
        template: "application_receipt",
        text: `Thanks for submitting your application for ${String(job.payload.tripName)}.`,
      });
      return;
    }
    case "send_confirmation_email": {
      await getEmailProvider().send({
        to: String(job.payload.recipientEmail),
        subject: "Please confirm this trip enrollment",
        template: "confirmation_request",
        text: `Use this confirmation link: /confirm/${String(job.payload.token)}`,
      });
      return;
    }
    case "send_signing_notice_email": {
      const ignorePreviousLink = String(job.payload.reason ?? "") === "restart"
        ? " Please ignore any earlier signing link you received."
        : "";

      await getEmailProvider().send({
        to: String(job.payload.recipientEmail),
        subject: "Your signing packet and insurance upload are ready",
        template: "documents_sent",
        text: `Documenso has emailed your signing packet.${ignorePreviousLink} Upload your insurance card here: ${String(job.payload.insuranceUploadUrl)}`,
      });
      return;
    }
    case "create_signing_packet": {
      await createPacketForEnrollment(String(job.payload.enrollmentId), {
        restartReason: typeof job.payload.restartReason === "string" ? job.payload.restartReason : null,
      });
      return;
    }
    case "create_quickbooks_invoice": {
      await createInvoiceForEnrollment(String(job.payload.enrollmentId));
      return;
    }
    case "process_signing_webhook": {
      const webhook = await db.query.externalWebhookEvents.findFirst({
        where: eq(externalWebhookEvents.id, String(job.payload.webhookEventId)),
      });

      if (!webhook) {
        return;
      }

      if (!webhook.signatureValid) {
        await markWebhookIgnored(webhook.id);
        return;
      }

      try {
        const event = await getSigningProvider().parseWebhook(JSON.stringify(webhook.payload));

        if (event) {
          await handleSigningWebhook(event);
        }

        await markWebhookProcessed(webhook.id);
      } catch (error) {
        await markWebhookFailed(webhook.id, error);
        throw error;
      }

      return;
    }
    case "process_quickbooks_webhook": {
      const webhook = await db.query.externalWebhookEvents.findFirst({
        where: eq(externalWebhookEvents.id, String(job.payload.webhookEventId)),
      });

      if (!webhook) {
        return;
      }

      if (!webhook.signatureValid) {
        await markWebhookIgnored(webhook.id);
        return;
      }

      try {
        const event = await getQuickBooksProvider().parseWebhook(JSON.stringify(webhook.payload));
        await handleQuickBooksWebhook(event);
        await markWebhookProcessed(webhook.id);
      } catch (error) {
        await markWebhookFailed(webhook.id, error);
        throw error;
      }

      return;
    }
    case "send_reminder": {
      await sendReminder({
        enrollmentId: String(job.payload.enrollmentId),
        reminderType: job.payload.reminderType as
          | "confirmation_pending"
          | "docs_pending"
          | "invoice_unpaid",
        recipientEmail: String(job.payload.recipientEmail),
      });
      return;
    }
    case "reconcile_open_invoice": {
      await syncInvoiceStatus(String(job.payload.enrollmentId));
      return;
    }
    case "run_reminder_sweep": {
      await scheduleReminderSweep();
      return;
    }
    case "mark_exception": {
      await markEnrollmentException({
        enrollmentId: String(job.payload.enrollmentId),
        reason: String(job.payload.reason),
        actorDisplay: "System",
      });
      return;
    }
    default:
      logger.warn({ jobType: job.type }, "Ignoring unknown job type");
  }
}
