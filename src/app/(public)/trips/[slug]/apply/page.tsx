import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ApplicationForm } from "@/components/forms/application-form";
import { canTripAcceptApplications, getTripBySlug } from "@/modules/trips/service";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = await getTripBySlug(slug, { includeArchived: true });

  if (!trip) {
    notFound();
  }

  if (!canTripAcceptApplications(trip)) {
    redirect(`/trips/${trip.slug}?closed=1`);
  }

  return (
    <AppShell
      title={`Apply for ${trip.name}`}
      description="Submit participant and guardian details. The system will create the enrollment, send a receipt, and either queue staff review or issue a secure confirmation link."
    >
      <ApplicationForm tripSlug={trip.slug} />
    </AppShell>
  );
}
