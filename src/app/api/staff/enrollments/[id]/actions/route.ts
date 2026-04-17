import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireStaffRouteSession } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";
import { enrollments, guardians } from "@/lib/db/schema";
import { issueConfirmationRequest } from "@/modules/confirmations/service";
import { createInvoiceForEnrollment } from "@/modules/billing/service";
import { resendPacket } from "@/modules/documents/service";
import {
  addEnrollmentNote,
  approveEnrollmentReview,
  markEnrollmentException,
  overrideEnrollmentReadiness,
} from "@/modules/enrollments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireStaffRouteSession("manager");

  if (!authResult.ok) {
    return authResult.response;
  }

  const session = authResult.session;
  const { id } = await params;
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "");

  try {
    if (action === "approve-review") {
      await approveEnrollmentReview({
        enrollmentId: id,
        staffUserId: session.user.id,
        actorDisplay: session.user.email ?? "Staff",
      });
    }

    if (action === "resend-confirmation") {
      const enrollment = await db.query.enrollments.findFirst({
        where: eq(enrollments.id, id),
      });

      if (!enrollment) {
        throw new Error("Enrollment not found");
      }

      const guardian = await db.query.guardians.findFirst({
        where: eq(guardians.id, enrollment.guardianId),
      });

      await issueConfirmationRequest({
        enrollmentId: id,
        recipientEmail: enrollment.alternateConfirmerEmail || guardian?.email || enrollment.submittedByEmail,
        actor: {
          type: "staff",
          id: session.user.id,
          display: session.user.email ?? "Staff",
        },
      });
    }

    if (action === "resend-docs") {
      await resendPacket(id);
    }

    if (action === "retry-invoice") {
      await createInvoiceForEnrollment(id);
    }

    if (action === "override-readiness") {
      await overrideEnrollmentReadiness({
        enrollmentId: id,
        staffUserId: session.user.id,
        actorDisplay: session.user.email ?? "Staff",
      });
    }

    if (action === "add-note") {
      await addEnrollmentNote({
        enrollmentId: id,
        body: String(formData.get("note") ?? ""),
        staffUserId: session.user.id,
        actorDisplay: session.user.email ?? "Staff",
      });
    }

    if (action === "mark-exception") {
      await markEnrollmentException({
        enrollmentId: id,
        reason: String(formData.get("reason") ?? ""),
        staffUserId: session.user.id,
        actorDisplay: session.user.email ?? "Staff",
      });
    }

    return NextResponse.redirect(new URL(`/enrollments/${id}`, request.url));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 400 },
    );
  }
}
