import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requireStaffPageSession } from "@/lib/auth/auth";
import { getEnrollmentDetail } from "@/modules/enrollments/service";

export const dynamic = "force-dynamic";

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireStaffPageSession("viewer", `/enrollments/${id}`);
  const detail = await getEnrollmentDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {detail.participant?.firstName} {detail.participant?.lastName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {detail.trip?.name} • {detail.guardian?.firstName} {detail.guardian?.lastName} • {detail.guardian?.email}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <Card className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="slate">{detail.enrollment.enrollmentStatus}</Badge>
            <Badge tone="sky">{detail.enrollment.confirmationStatus}</Badge>
            <Badge tone="amber">{detail.enrollment.packetStatus}</Badge>
            <Badge tone="emerald">{detail.enrollment.billingStatus}</Badge>
            <Badge tone={detail.enrollment.readinessStatus === "ready" ? "emerald" : "rose"}>
              {detail.enrollment.readinessStatus}
            </Badge>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Submitted by: {detail.enrollment.submittedByEmail}</p>
            <p>Alternate confirmer: {detail.enrollment.alternateConfirmerEmail ?? "Not set"}</p>
            <p>Confirmation due: {detail.enrollment.confirmationDueAt?.toLocaleString() ?? "N/A"}</p>
            <p>Docs due: {detail.enrollment.docsDueAt?.toLocaleString() ?? "N/A"}</p>
            <p>Payment due: {detail.enrollment.paymentDueAt?.toLocaleString() ?? "N/A"}</p>
          </div>
        </Card>
        <Card className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            <form action={`/api/staff/enrollments/${detail.enrollment.id}/actions`} method="post">
              <input type="hidden" name="action" value="approve-review" />
              <Button type="submit" className="w-full">Approve review</Button>
            </form>
            <form action={`/api/staff/enrollments/${detail.enrollment.id}/actions`} method="post">
              <input type="hidden" name="action" value="resend-confirmation" />
              <Button type="submit" className="w-full" variant="secondary">Resend confirmation</Button>
            </form>
            <form action={`/api/staff/enrollments/${detail.enrollment.id}/actions`} method="post">
              <input type="hidden" name="action" value="resend-docs" />
              <Button type="submit" className="w-full" variant="secondary">Resend docs</Button>
            </form>
            <form action={`/api/staff/enrollments/${detail.enrollment.id}/actions`} method="post">
              <input type="hidden" name="action" value="retry-invoice" />
              <Button type="submit" className="w-full" variant="secondary">Retry invoice</Button>
            </form>
            <form action={`/api/staff/enrollments/${detail.enrollment.id}/actions`} method="post">
              <input type="hidden" name="action" value="override-readiness" />
              <Button type="submit" className="w-full" variant="ghost">Override readiness</Button>
            </form>
          </div>
          <form action={`/api/staff/enrollments/${detail.enrollment.id}/actions`} method="post" className="space-y-3">
            <input type="hidden" name="action" value="add-note" />
            <Textarea name="note" placeholder="Add an operational note..." required />
            <Button type="submit">Add note</Button>
          </form>
          <form action={`/api/staff/enrollments/${detail.enrollment.id}/actions`} method="post" className="space-y-3">
            <input type="hidden" name="action" value="mark-exception" />
            <Textarea name="reason" placeholder="Reason for exception or manual block..." required />
            <Button type="submit" variant="danger">Mark exception</Button>
          </form>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">Audit timeline</h2>
          <div className="space-y-3 text-sm">
            {detail.auditTrail.map((event) => (
              <div key={String(event.id)} className="rounded-xl border border-slate-200 p-3">
                <div className="font-medium text-slate-900">{String(event.action)}</div>
                <div className="text-slate-500">{String(event.actor_display ?? event.actorDisplay ?? "Unknown actor")}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">Notes and reminders</h2>
          <div className="space-y-3 text-sm">
            {detail.notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-slate-200 p-3 text-slate-700">
                {note.body}
              </div>
            ))}
            {detail.reminders.map((reminder) => (
              <div key={reminder.id} className="rounded-xl border border-slate-200 p-3 text-slate-500">
                Reminder: {reminder.reminderType} to {reminder.recipientEmail}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
