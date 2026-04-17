import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { billingRecords, enrollments, guardians, trips } from "@/lib/db/schema";
import { getQuickBooksProvider } from "@/lib/providers/quickbooks";
import type { QuickBooksWebhookEvent } from "@/lib/providers/quickbooks/types";
import { recordAuditEvent } from "@/modules/audit/service";
import { refreshEnrollmentReadiness } from "@/modules/enrollments/service";

export async function createInvoiceForEnrollment(enrollmentId: string) {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(enrollments.id, enrollmentId),
  });

  if (!enrollment) {
    throw new Error("Enrollment not found");
  }

  const existing = await db.query.billingRecords.findFirst({
    where: eq(billingRecords.enrollmentId, enrollmentId),
  });

  if (existing?.invoiceExternalId) {
    return existing;
  }

  const [guardian, trip] = await Promise.all([
    db.query.guardians.findFirst({ where: eq(guardians.id, enrollment.guardianId) }),
    db.query.trips.findFirst({ where: eq(trips.id, enrollment.tripId) }),
  ]);

  if (!guardian || !trip) {
    throw new Error("Billing context missing");
  }

  const provider = getQuickBooksProvider();
  const customer = await provider.findOrCreateCustomer({
    enrollmentId,
    guardianName: `${guardian.firstName} ${guardian.lastName}`,
    guardianEmail: guardian.email,
  });
  const invoice = await provider.createInvoice({
    customerId: customer.customerId,
    enrollmentId,
    amountCents: enrollment.invoiceAmountCents,
    description: trip.invoiceDescription,
  });

  const record = existing
    ? (
        await db
          .update(billingRecords)
          .set({
            customerExternalId: customer.customerId,
            invoiceExternalId: invoice.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            billingStatus: invoice.status,
            amountCents: invoice.amountCents,
            balanceCents: invoice.balanceCents,
            invoiceUrl: invoice.invoiceUrl ?? null,
            invoicedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(billingRecords.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(billingRecords)
          .values({
            enrollmentId,
            customerExternalId: customer.customerId,
            invoiceExternalId: invoice.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            billingStatus: invoice.status,
            amountCents: invoice.amountCents,
            balanceCents: invoice.balanceCents,
            invoiceUrl: invoice.invoiceUrl ?? null,
            invoicedAt: new Date(),
          })
          .returning()
      )[0];

  await db
    .update(enrollments)
    .set({
      billingStatus: invoice.status,
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, enrollmentId));

  await recordAuditEvent({
    actorType: "system",
    actorDisplay: "QuickBooks",
    action: "invoice.created",
    enrollmentId,
    metadata: {
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
    },
  });

  return record;
}

export async function syncInvoiceStatus(enrollmentId: string) {
  const record = await db.query.billingRecords.findFirst({
    where: eq(billingRecords.enrollmentId, enrollmentId),
  });

  if (!record?.invoiceExternalId) {
    throw new Error("Invoice not found");
  }

  const status = await getQuickBooksProvider().fetchInvoiceStatus(record.invoiceExternalId);

  await db
    .update(billingRecords)
    .set({
      billingStatus: status.status,
      balanceCents: status.balanceCents,
      paidAt: status.paidAt ? new Date(status.paidAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(billingRecords.id, record.id));

  await db
    .update(enrollments)
    .set({
      billingStatus: status.status,
      paymentReceivedAt: status.paidAt ? new Date(status.paidAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, enrollmentId));

  await refreshEnrollmentReadiness(enrollmentId);
}

export async function handleQuickBooksWebhook(event: QuickBooksWebhookEvent) {
  const record = await db.query.billingRecords.findFirst({
    where: eq(billingRecords.invoiceExternalId, event.entityId),
  });

  if (!record) {
    return;
  }

  await syncInvoiceStatus(record.enrollmentId);

  await recordAuditEvent({
    actorType: "system",
    actorDisplay: "QuickBooks",
    action: `billing.${event.type}`,
    enrollmentId: record.enrollmentId,
    metadata: event,
  });
}
