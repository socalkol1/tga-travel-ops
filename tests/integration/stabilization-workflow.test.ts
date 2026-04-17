import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  billingRecords,
  documentPackets,
  enrollments,
  fileArtifacts,
  guardians,
  participants,
  trips,
} from "@/lib/db/schema";
import { setupModuleContext } from "../helpers/module-context";

function buildApplicationPayload(tripSlug: string) {
  return {
    tripSlug,
    participantFirstName: "Jamie",
    participantLastName: "Wrestler",
    participantBirthDate: "2011-04-15",
    participantEmail: "jamie@example.org",
    participantPhone: "555-111-2222",
    participantGradeLevel: "8",
    participantClubName: "TGA Wrestling",
    guardianFirstName: "Chris",
    guardianLastName: "Guardian",
    guardianEmail: "guardian@example.org",
    guardianPhone: "555-222-3333",
    guardianRelationship: "parent",
    addressLine1: "123 Main Street",
    addressLine2: "",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    alternateConfirmerEmail: "",
  };
}

async function seedTrip(
  db: Awaited<ReturnType<typeof setupModuleContext>>["db"],
  input: {
    slug: string;
    openAt: string;
    closeAt: string;
    isArchived?: boolean;
    requiresStaffReview?: boolean;
  },
) {
  const inserted = await db
    .insert(trips)
    .values({
      id: randomUUID(),
      name: input.slug,
      slug: input.slug,
      seasonYear: 2026,
      description: `${input.slug} trip`,
      enrollmentOpenAt: new Date(input.openAt),
      enrollmentCloseAt: new Date(input.closeAt),
      invoiceDescription: `${input.slug} invoice`,
      signingTemplateId: "tpl_1",
      isArchived: input.isArchived ?? false,
      requiresStaffReview: input.requiresStaffReview ?? false,
    })
    .returning();

  return inserted[0];
}

async function seedEnrollment(
  db: Awaited<ReturnType<typeof setupModuleContext>>["db"],
  tripId: string,
) {
  const participantId = randomUUID();
  const guardianId = randomUUID();
  const enrollmentId = randomUUID();

  await db.insert(participants).values({
    id: participantId,
    firstName: "Jamie",
    lastName: "Wrestler",
  });

  await db.insert(guardians).values({
    id: guardianId,
    firstName: "Chris",
    lastName: "Guardian",
    email: "guardian@example.org",
  });

  const inserted = await db
    .insert(enrollments)
    .values({
      id: enrollmentId,
      tripId,
      participantId,
      guardianId,
      submittedByEmail: "guardian@example.org",
      enrollmentStatus: "awaiting_confirmation",
      confirmationStatus: "pending",
      invoiceAmountCents: 125000,
    })
    .returning();

  return inserted[0];
}

describe("stabilization workflow", () => {
  it("returns 201 for open trips and 409 for unavailable public application posts", async () => {
    const context = await setupModuleContext();

    try {
      await seedTrip(context.db, {
        slug: "open-trip",
        openAt: "2026-01-01T00:00:00.000Z",
        closeAt: "2026-12-31T23:59:59.000Z",
      });
      await seedTrip(context.db, {
        slug: "future-trip",
        openAt: "2026-12-01T00:00:00.000Z",
        closeAt: "2027-01-31T23:59:59.000Z",
      });
      await seedTrip(context.db, {
        slug: "closed-trip",
        openAt: "2025-01-01T00:00:00.000Z",
        closeAt: "2025-12-31T23:59:59.000Z",
      });
      await seedTrip(context.db, {
        slug: "archived-trip",
        openAt: "2026-01-01T00:00:00.000Z",
        closeAt: "2026-12-31T23:59:59.000Z",
        isArchived: true,
      });

      const { POST } = await import("@/app/api/public/applications/route");

      const openResponse = await POST(new Request("http://localhost/api/public/applications", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(buildApplicationPayload("open-trip")),
      }));

      expect(openResponse.status).toBe(201);

      for (const slug of ["future-trip", "closed-trip", "archived-trip"]) {
        const response = await POST(new Request("http://localhost/api/public/applications", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(buildApplicationPayload(slug)),
        }));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
          code: "trip_not_accepting_applications",
          error: "Trip is not accepting applications",
        });
      }
    } finally {
      await context.client.close();
    }
  });

  it("ignores empty or invalid dashboard status filters instead of sending invalid enum values to Postgres", async () => {
    const context = await setupModuleContext();

    try {
      const trip = await seedTrip(context.db, {
        slug: "status-filter-trip",
        openAt: "2026-01-01T00:00:00.000Z",
        closeAt: "2026-12-31T23:59:59.000Z",
      });

      await seedEnrollment(context.db, trip.id);

      const { listEnrollments } = await import("@/modules/enrollments/service");

      await expect(listEnrollments()).resolves.toEqual(expect.any(Array));
      await expect(listEnrollments({ status: "" })).resolves.toEqual(expect.any(Array));
      await expect(listEnrollments({ status: "not-a-real-status" })).resolves.toEqual(expect.any(Array));
      await expect(listEnrollments({ status: "awaiting_confirmation" })).resolves.toEqual(expect.any(Array));
    } finally {
      await context.client.close();
    }
  });

  it("rolls back application submission if job enqueue fails", async () => {
    const context = await setupModuleContext();

    try {
      const trip = await seedTrip(context.db, {
        slug: "rollback-trip",
        openAt: "2026-01-01T00:00:00.000Z",
        closeAt: "2026-12-31T23:59:59.000Z",
      });

      vi.doMock("@/modules/jobs/service", async () => {
        const actual = await vi.importActual<typeof import("@/modules/jobs/service")>("@/modules/jobs/service");

        return {
          ...actual,
          enqueueJob: vi.fn(async (input: { type: string }) => {
            if (input.type === "send_application_receipt") {
              throw new Error("receipt enqueue failed");
            }

            return null;
          }),
        };
      });

      const { submitApplication } = await import("@/modules/enrollments/service");

      await expect(
        submitApplication(buildApplicationPayload(trip.slug)),
      ).rejects.toThrow("receipt enqueue failed");

      expect(await context.db.query.participants.findMany()).toHaveLength(0);
      expect(await context.db.query.guardians.findMany()).toHaveLength(0);
      expect(await context.db.query.enrollments.findMany()).toHaveLength(0);
      expect(await context.db.query.jobs.findMany()).toHaveLength(0);
      expect(await context.db.query.auditEvents.findMany()).toHaveLength(0);
    } finally {
      await context.client.close();
    }
  });

  it("rolls back confirmation issuance and review approval if the confirmation job cannot be enqueued", async () => {
    const context = await setupModuleContext();

    try {
      const trip = await seedTrip(context.db, {
        slug: "review-trip",
        openAt: "2026-01-01T00:00:00.000Z",
        closeAt: "2026-12-31T23:59:59.000Z",
        requiresStaffReview: true,
      });

      const enrollment = await seedEnrollment(context.db, trip.id);

      await context.db
        .update(enrollments)
        .set({
          enrollmentStatus: "awaiting_review",
          requiresReview: true,
        })
        .where(eq(enrollments.id, enrollment.id));

      vi.doMock("@/modules/jobs/service", async () => {
        const actual = await vi.importActual<typeof import("@/modules/jobs/service")>("@/modules/jobs/service");

        return {
          ...actual,
          enqueueJob: vi.fn(async (input: { type: string }) => {
            if (input.type === "send_confirmation_email") {
              throw new Error("confirmation enqueue failed");
            }

            return null;
          }),
        };
      });

      const { issueConfirmationRequest } = await import("@/modules/confirmations/service");
      const { approveEnrollmentReview } = await import("@/modules/enrollments/service");

      await expect(
        issueConfirmationRequest({
          enrollmentId: enrollment.id,
          recipientEmail: "guardian@example.org",
          actor: {
            type: "staff",
            display: "Staff User",
          },
        }),
      ).rejects.toThrow("confirmation enqueue failed");

      expect(await context.db.query.tokenLinks.findMany()).toHaveLength(0);
      expect(await context.db.query.confirmationRequests.findMany()).toHaveLength(0);

      const enrollmentAfterDirectIssue = await context.db.query.enrollments.findFirst({
        where: eq(enrollments.id, enrollment.id),
      });

      expect(enrollmentAfterDirectIssue?.confirmationStatus).toBe("pending");

      await expect(
        approveEnrollmentReview({
          enrollmentId: enrollment.id,
          actorDisplay: "manager@example.org",
        }),
      ).rejects.toThrow("confirmation enqueue failed");

      const enrollmentAfterReview = await context.db.query.enrollments.findFirst({
        where: eq(enrollments.id, enrollment.id),
      });

      expect(enrollmentAfterReview?.enrollmentStatus).toBe("awaiting_review");
      expect(enrollmentAfterReview?.requiresReview).toBe(true);
      expect(await context.db.query.tokenLinks.findMany()).toHaveLength(0);
      expect(await context.db.query.confirmationRequests.findMany()).toHaveLength(0);
    } finally {
      await context.client.close();
    }
  });

  it("expires prior confirmation tokens and prevents stale token consumption from mutating enrollment state", async () => {
    const context = await setupModuleContext();

    try {
      const trip = await seedTrip(context.db, {
        slug: "token-trip",
        openAt: "2026-01-01T00:00:00.000Z",
        closeAt: "2026-12-31T23:59:59.000Z",
      });
      const enrollment = await seedEnrollment(context.db, trip.id);

      const { issueConfirmationRequest, consumeConfirmationToken } = await import("@/modules/confirmations/service");

      const first = await issueConfirmationRequest({
        enrollmentId: enrollment.id,
        recipientEmail: "guardian@example.org",
        actor: {
          type: "staff",
          display: "Staff User",
        },
      });

      const second = await issueConfirmationRequest({
        enrollmentId: enrollment.id,
        recipientEmail: "guardian@example.org",
        actor: {
          type: "staff",
          display: "Staff User",
        },
      });

      expect(first.token).not.toBe(second.token);

      await expect(
        consumeConfirmationToken({
          rawToken: first.token,
          actorDisplay: "Guardian confirmation link",
        }),
      ).rejects.toThrow("Confirmation token expired");

      const enrollmentAfterStaleToken = await context.db.query.enrollments.findFirst({
        where: eq(enrollments.id, enrollment.id),
      });
      expect(enrollmentAfterStaleToken?.enrollmentStatus).toBe("awaiting_confirmation");
      expect(enrollmentAfterStaleToken?.confirmationStatus).toBe("sent");

      await consumeConfirmationToken({
        rawToken: second.token,
        actorDisplay: "Guardian confirmation link",
      });

      await expect(
        consumeConfirmationToken({
          rawToken: second.token,
          actorDisplay: "Guardian confirmation link",
        }),
      ).rejects.toThrow("Confirmation token already used");
    } finally {
      await context.client.close();
    }
  });

  it("processes the full apply-confirm-signing-insurance-invoice flow", async () => {
    const context = await setupModuleContext();

    try {
      await seedTrip(context.db, {
        slug: "workflow-trip",
        openAt: "2026-01-01T00:00:00.000Z",
        closeAt: "2026-12-31T23:59:59.000Z",
      });

      vi.doMock("@/lib/providers/storage/supabase", () => ({
        uploadPrivateArtifact: vi.fn(async ({ path }: { path: string }) => ({
          bucket: "trip-artifacts",
          path,
        })),
      }));

      const { submitApplication } = await import("@/modules/enrollments/service");
      const { consumeConfirmationToken } = await import("@/modules/confirmations/service");
      const { createInvoiceForEnrollment } = await import("@/modules/billing/service");
      const { createPacketForEnrollment, handleSigningWebhook } = await import("@/modules/documents/service");
      const { uploadInsuranceArtifact } = await import("@/modules/insurance/service");

      const enrollment = await submitApplication(buildApplicationPayload("workflow-trip"));
      const queuedJobs = await context.db.query.jobs.findMany();
      const confirmationJob = queuedJobs.find((job) => job.type === "send_confirmation_email");

      expect(queuedJobs.map((job) => job.type)).toEqual(
        expect.arrayContaining(["send_application_receipt", "send_confirmation_email"]),
      );
      expect(confirmationJob).toBeDefined();

      const rawToken = String((confirmationJob?.payload as Record<string, unknown>).token);

      await consumeConfirmationToken({
        rawToken,
        actorDisplay: "Guardian confirmation link",
      });

      const postConfirmationJobs = await context.db.query.jobs.findMany();
      expect(postConfirmationJobs.map((job) => job.type)).toEqual(
        expect.arrayContaining(["create_signing_packet", "create_quickbooks_invoice"]),
      );

      await createPacketForEnrollment(enrollment.id);
      await createInvoiceForEnrollment(enrollment.id);

      const packet = await context.db.query.documentPackets.findFirst({
        where: eq(documentPackets.enrollmentId, enrollment.id),
      });
      const invoice = await context.db.query.billingRecords.findFirst({
        where: eq(billingRecords.enrollmentId, enrollment.id),
      });

      expect(packet?.packetStatus).toBe("sent");
      expect(packet?.providerSubmissionId).toBeTruthy();
      expect(packet?.provider).toBe("documenso");
      expect(invoice?.billingStatus).toBe("open");

      const jobsAfterPacket = await context.db.query.jobs.findMany();
      const signingNoticeJob = jobsAfterPacket.find((job) => job.type === "send_signing_notice_email");
      const insuranceUploadUrl = String(
        (signingNoticeJob?.payload as Record<string, unknown>).insuranceUploadUrl ?? "",
      );
      const insuranceToken = insuranceUploadUrl.split("/insurance/")[1];

      expect(insuranceToken).toBeTruthy();

      await uploadInsuranceArtifact({
        rawToken: insuranceToken,
        file: new File([new Uint8Array([1, 2, 3])], "insurance-card.pdf", {
          type: "application/pdf",
        }),
      });

      await handleSigningWebhook({
        eventId: `DOCUMENT_COMPLETED:${packet?.providerSubmissionId}:2026-04-15T12:00:00.000Z`,
        type: "document.completed",
        documentId: String(packet?.providerSubmissionId),
        occurredAt: "2026-04-15T12:00:00.000Z",
      });

      const completedEnrollment = await context.db.query.enrollments.findFirst({
        where: eq(enrollments.id, enrollment.id),
      });
      const completedPacket = await context.db.query.documentPackets.findFirst({
        where: eq(documentPackets.enrollmentId, enrollment.id),
      });
      const artifacts = await context.db.query.fileArtifacts.findMany({
        where: eq(fileArtifacts.enrollmentId, enrollment.id),
      });

      expect(completedEnrollment?.packetStatus).toBe("completed");
      expect(completedEnrollment?.insuranceUploadedAt).toBeTruthy();
      expect(completedPacket?.packetStatus).toBe("completed");
      expect(artifacts).toHaveLength(2);
    } finally {
      await context.client.close();
    }
  });
});
