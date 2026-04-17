import { addDays } from "date-fns";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  enrollmentNotes,
  enrollments,
  guardians,
  participants,
  reminderSends,
  trips,
} from "@/lib/db/schema";
import { calculateReadiness } from "@/lib/security/readiness";
import { recordAuditEvent } from "@/modules/audit/service";
import { issueConfirmationRequestTx } from "@/modules/confirmations/service";
import type { ApplicationInput } from "@/modules/enrollments/schemas";
import { enqueueJob } from "@/modules/jobs/service";
import {
  assertTripAcceptingApplications,
  TripNotAcceptingApplicationsError,
} from "@/modules/trips/service";

export class DuplicateApplicationError extends Error {
  constructor() {
    super("A matching application already exists for this trip");
  }
}

const enrollmentStatusFilters = new Set([
  "applied",
  "awaiting_review",
  "awaiting_confirmation",
  "confirmed",
  "cancelled",
  "declined",
]);

const readinessStatusFilters = new Set([
  "not_ready",
  "ready",
  "blocked",
  "exception",
]);

export function buildApplicationFingerprint(input: {
  tripId: string;
  guardianEmail: string;
  participantFirstName: string;
  participantLastName: string;
}) {
  return [
    input.tripId.trim().toLowerCase(),
    input.guardianEmail.trim().toLowerCase(),
    input.participantFirstName.trim().toLowerCase(),
    input.participantLastName.trim().toLowerCase(),
  ].join("::");
}

function isApplicationFingerprintConflict(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("enrollments_application_fingerprint_idx")
  );
}

export async function submitApplication(input: ApplicationInput) {
  const initialTrip = await db.query.trips.findFirst({
    where: eq(trips.slug, input.tripSlug),
  });

  if (!initialTrip) {
    throw new Error("Trip not found");
  }

  assertTripAcceptingApplications(initialTrip);

  const applicationFingerprint = buildApplicationFingerprint({
    tripId: initialTrip.id,
    guardianEmail: input.guardianEmail,
    participantFirstName: input.participantFirstName,
    participantLastName: input.participantLastName,
  });

  try {
    return await db.transaction(async (tx) => {
      const trip = await tx.query.trips.findFirst({
        where: eq(trips.slug, input.tripSlug),
      });

      if (!trip) {
        throw new Error("Trip not found");
      }

      assertTripAcceptingApplications(trip);

      const duplicate = await tx.query.enrollments.findFirst({
        where: eq(enrollments.applicationFingerprint, applicationFingerprint),
      });

      if (duplicate) {
        throw new DuplicateApplicationError();
      }

      const participant = await tx
        .insert(participants)
        .values({
          firstName: input.participantFirstName,
          lastName: input.participantLastName,
          birthDate: input.participantBirthDate ? new Date(input.participantBirthDate) : null,
          email: input.participantEmail || null,
          phone: input.participantPhone || null,
          gradeLevel: input.participantGradeLevel || null,
          clubName: input.participantClubName || null,
        })
        .returning();

      const guardian = await tx
        .insert(guardians)
        .values({
          firstName: input.guardianFirstName,
          lastName: input.guardianLastName,
          email: input.guardianEmail.toLowerCase(),
          phone: input.guardianPhone,
          relationship: input.guardianRelationship,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 || "",
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
        })
        .returning();

      const confirmationDueAt = addDays(new Date(), trip.confirmationDeadlineDays);
      const docsDueAt = addDays(new Date(), trip.docsDeadlineDays);
      const paymentDueAt = addDays(new Date(), trip.paymentDeadlineDays);

      const enrollment = await tx
        .insert(enrollments)
        .values({
          tripId: trip.id,
          participantId: participant[0].id,
          guardianId: guardian[0].id,
          submittedByEmail: guardian[0].email,
          alternateConfirmerEmail: input.alternateConfirmerEmail || null,
          enrollmentStatus: trip.requiresStaffReview ? "awaiting_review" : "awaiting_confirmation",
          confirmationStatus: "pending",
          packetStatus: "not_started",
          billingStatus: "not_created",
          readinessStatus: "not_ready",
          requiresReview: trip.requiresStaffReview,
          confirmationDueAt,
          docsDueAt,
          paymentDueAt,
          invoiceAmountCents: trip.basePriceCents,
          applicationFingerprint,
        })
        .returning();

      await recordAuditEvent({
        actorType: "external",
        actorDisplay: guardian[0].email,
        action: "application.submitted",
        enrollmentId: enrollment[0].id,
        tripId: trip.id,
        metadata: {
          tripSlug: trip.slug,
          alternateConfirmerEmail: input.alternateConfirmerEmail || null,
        },
        executor: tx,
      });

      await enqueueJob({
        type: "send_application_receipt",
        payload: {
          enrollmentId: enrollment[0].id,
          recipientEmail: guardian[0].email,
          tripName: trip.name,
        },
        idempotencyKey: `application-receipt:${enrollment[0].id}`,
        executor: tx,
      });

      if (!trip.requiresStaffReview) {
        await issueConfirmationRequestTx(tx, {
          enrollmentId: enrollment[0].id,
          recipientEmail: input.alternateConfirmerEmail || guardian[0].email,
          actor: {
            type: "system",
            display: "System",
          },
        });
      }

      return enrollment[0];
    });
  } catch (error) {
    if (error instanceof TripNotAcceptingApplicationsError || error instanceof DuplicateApplicationError) {
      throw error;
    }

    if (isApplicationFingerprintConflict(error)) {
      throw new DuplicateApplicationError();
    }

    throw error;
  }
}

export async function listEnrollments(params?: {
  tripId?: string;
  query?: string;
  status?: string;
}) {
  const tripId = params?.tripId?.trim() || null;
  const search = params?.query?.trim();
  const searchPattern = search ? `%${search}%` : null;
  const status = params?.status?.trim() || null;
  const matchesEnrollmentStatus = Boolean(status && enrollmentStatusFilters.has(status));
  const matchesReadinessStatus = Boolean(status && readinessStatusFilters.has(status));

  const results = await db.execute(sql`
    select
      e.*,
      t.name as trip_name,
      p.first_name as participant_first_name,
      p.last_name as participant_last_name,
      g.first_name as guardian_first_name,
      g.last_name as guardian_last_name,
      g.email as guardian_email
    from enrollments e
    join trips t on t.id = e.trip_id
    join participants p on p.id = e.participant_id
    join guardians g on g.id = e.guardian_id
    where (${tripId}::uuid is null or e.trip_id = ${tripId}::uuid)
      ${status && (matchesReadinessStatus || matchesEnrollmentStatus)
        ? sql`and (
            ${matchesReadinessStatus ? sql`e.readiness_status = ${status}` : sql`false`}
            or ${matchesEnrollmentStatus ? sql`e.enrollment_status = ${status}` : sql`false`}
          )`
        : sql``}
      ${searchPattern
        ? sql`and (
            p.first_name ilike ${searchPattern}
            or p.last_name ilike ${searchPattern}
            or g.email ilike ${searchPattern}
            or g.first_name ilike ${searchPattern}
            or g.last_name ilike ${searchPattern}
          )`
        : sql``}
    order by e.created_at desc
    limit 100
  `);

  return Array.from(results) as Array<Record<string, string>>;
}

export async function getEnrollmentDetail(id: string) {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(enrollments.id, id),
  });

  if (!enrollment) {
    return null;
  }

  const [trip, participant, guardian, notes, reminders, auditTrailQuery] = await Promise.all([
    db.query.trips.findFirst({ where: eq(trips.id, enrollment.tripId) }),
    db.query.participants.findFirst({ where: eq(participants.id, enrollment.participantId) }),
    db.query.guardians.findFirst({ where: eq(guardians.id, enrollment.guardianId) }),
    db.query.enrollmentNotes.findMany({
      where: eq(enrollmentNotes.enrollmentId, enrollment.id),
      orderBy: [desc(enrollmentNotes.createdAt)],
    }),
    db.query.reminderSends.findMany({
      where: eq(reminderSends.enrollmentId, enrollment.id),
      orderBy: [desc(reminderSends.sentAt)],
    }),
    db.execute(sql`
      select *
      from audit_events
      where enrollment_id = ${enrollment.id}
      order by occurred_at desc
    `),
  ]);

  return {
    enrollment: {
      ...enrollment,
      readinessStatus: calculateReadiness({
        confirmationStatus: enrollment.confirmationStatus,
        packetStatus: enrollment.packetStatus,
        billingStatus: enrollment.billingStatus,
        insuranceUploadedAt: enrollment.insuranceUploadedAt,
        readyOverride: enrollment.readyOverride,
        exceptionReason: enrollment.exceptionReason,
      }),
    },
    trip,
    participant,
    guardian,
    notes,
    auditTrail: Array.from(auditTrailQuery) as Array<Record<string, unknown>>,
    reminders,
  };
}

export async function addEnrollmentNote(input: {
  enrollmentId: string;
  body: string;
  staffUserId?: string;
  actorDisplay: string;
}) {
  await db.insert(enrollmentNotes).values({
    enrollmentId: input.enrollmentId,
    authorStaffUserId: input.staffUserId ?? null,
    body: input.body,
  });

  await db
    .update(enrollments)
    .set({ latestNote: input.body, updatedAt: new Date() })
    .where(eq(enrollments.id, input.enrollmentId));

  await recordAuditEvent({
    actorType: "staff",
    actorId: input.staffUserId,
    actorDisplay: input.actorDisplay,
    action: "note.added",
    enrollmentId: input.enrollmentId,
    metadata: { body: input.body },
  });
}

export async function markEnrollmentException(input: {
  enrollmentId: string;
  reason: string;
  staffUserId?: string;
  actorDisplay: string;
}) {
  await db
    .update(enrollments)
    .set({
      exceptionReason: input.reason,
      readinessStatus: "exception",
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, input.enrollmentId));

  await recordAuditEvent({
    actorType: "staff",
    actorId: input.staffUserId,
    actorDisplay: input.actorDisplay,
    action: "exception.marked",
    enrollmentId: input.enrollmentId,
    metadata: { reason: input.reason },
  });
}

export async function overrideEnrollmentReadiness(input: {
  enrollmentId: string;
  staffUserId?: string;
  actorDisplay: string;
}) {
  await db
    .update(enrollments)
    .set({
      readyOverride: true,
      readinessStatus: "ready",
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, input.enrollmentId));

  await recordAuditEvent({
    actorType: "staff",
    actorId: input.staffUserId,
    actorDisplay: input.actorDisplay,
    action: "readiness.overridden",
    enrollmentId: input.enrollmentId,
  });
}

export async function approveEnrollmentReview(input: {
  enrollmentId: string;
  staffUserId?: string;
  actorDisplay: string;
}) {
  await db.transaction(async (tx) => {
    const enrollment = await tx.query.enrollments.findFirst({
      where: eq(enrollments.id, input.enrollmentId),
    });

    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    await tx
      .update(enrollments)
      .set({
        requiresReview: false,
        enrollmentStatus: "awaiting_confirmation",
        reviewDecisionAt: new Date(),
        reviewDecisionBy: input.staffUserId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, input.enrollmentId));

    const guardian = await tx.query.guardians.findFirst({
      where: eq(guardians.id, enrollment.guardianId),
    });

    await issueConfirmationRequestTx(tx, {
      enrollmentId: input.enrollmentId,
      recipientEmail: enrollment.alternateConfirmerEmail || guardian?.email || enrollment.submittedByEmail,
      actor: {
        type: "staff",
        id: input.staffUserId,
        display: input.actorDisplay,
      },
    });

    await recordAuditEvent({
      actorType: "staff",
      actorId: input.staffUserId,
      actorDisplay: input.actorDisplay,
      action: "review.approved",
      enrollmentId: input.enrollmentId,
      executor: tx,
    });
  });
}

export async function refreshEnrollmentReadiness(enrollmentId: string) {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(enrollments.id, enrollmentId),
  });

  if (!enrollment) {
    return;
  }

  const readinessStatus = calculateReadiness({
    confirmationStatus: enrollment.confirmationStatus,
    packetStatus: enrollment.packetStatus,
    billingStatus: enrollment.billingStatus,
    insuranceUploadedAt: enrollment.insuranceUploadedAt,
    readyOverride: enrollment.readyOverride,
    exceptionReason: enrollment.exceptionReason,
  });

  await db
    .update(enrollments)
    .set({
      readinessStatus,
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, enrollmentId));
}
