import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { canTripAcceptApplications, getTripApplicationState, getTripBySlug } from "@/modules/trips/service";

export const dynamic = "force-dynamic";

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ closed?: string }>;
}) {
  const { slug } = await params;
  const { closed } = await searchParams;
  const trip = await getTripBySlug(slug, { includeArchived: true });

  if (!trip) {
    notFound();
  }

  const applicationState = getTripApplicationState(trip);
  const canApply = canTripAcceptApplications(trip);

  const statusBadge =
    applicationState === "archived"
      ? { tone: "slate" as const, label: "Archived" }
      : applicationState === "not_yet_open"
        ? { tone: "sky" as const, label: "Applications open soon" }
        : applicationState === "closed"
          ? { tone: "rose" as const, label: "Applications closed" }
          : {
              tone: trip.requiresStaffReview ? ("amber" as const) : ("emerald" as const),
              label: trip.requiresStaffReview ? "Staff review required" : "Open for direct confirmation",
            };

  return (
    <AppShell
      title={trip.name}
      description={trip.description}
    >
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <div className="space-y-4">
            <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
            <div className="space-y-1 text-sm text-slate-600">
              <p>Season: {trip.seasonYear}</p>
              <p>Enrollment closes: {trip.enrollmentCloseAt.toLocaleDateString()}</p>
              <p>Base price: ${(trip.basePriceCents / 100).toFixed(2)}</p>
              <p>Confirmation due: {trip.confirmationDeadlineDays} days after submission</p>
              <p>Document deadline: {trip.docsDeadlineDays} days after confirmation</p>
            </div>
            {closed === "1" ? (
              <p className="text-sm text-amber-700">
                Applications are not currently available for this trip.
              </p>
            ) : null}
          </div>
        </Card>
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-950">
            {canApply ? "Apply for this trip" : "Application status"}
          </h2>
          {applicationState === "not_yet_open" ? (
            <p className="text-sm leading-7 text-slate-600">
              Applications for this trip open on {trip.enrollmentOpenAt.toLocaleDateString()}.
            </p>
          ) : null}
          {applicationState === "closed" ? (
            <p className="text-sm leading-7 text-slate-600">
              Applications for this trip are closed.
            </p>
          ) : null}
          {applicationState === "archived" ? (
            <p className="text-sm leading-7 text-slate-600">
              This trip has been archived and is no longer accepting applications.
            </p>
          ) : null}
          {canApply ? (
            <>
              <p className="text-sm leading-7 text-slate-600">
                Applications create an enrollment in the internal operations system immediately. If this
                trip supports alternate confirmation, a separate recipient can be emailed the follow-up
                link after submission.
              </p>
              <Link href={`/trips/${trip.slug}/apply`}>
                <Button>Start application</Button>
              </Link>
            </>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
