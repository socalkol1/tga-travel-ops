import { requireStaffPageSession } from "@/lib/auth/auth";
import { listTrips } from "@/modules/trips/service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  await requireStaffPageSession("viewer", "/trips");
  const trips = await listTrips({ includeArchived: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Trips</h1>
        <p className="mt-2 text-sm text-slate-600">
          Trip definitions drive deadlines, confirmation behavior, packet template mapping, and pricing.
        </p>
      </div>
      <div className="grid gap-4">
        {trips.map((trip) => (
          <Card key={trip.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-950">{trip.name}</h2>
                <p className="text-sm text-slate-600">{trip.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="slate">{trip.slug}</Badge>
                  <Badge tone="sky">{trip.seasonYear}</Badge>
                  <Badge tone={trip.requiresStaffReview ? "amber" : "emerald"}>
                    {trip.requiresStaffReview ? "Review required" : "No review"}
                  </Badge>
                </div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <div>${(trip.basePriceCents / 100).toFixed(2)}</div>
                <div>{trip.isArchived ? "Archived" : "Active"}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
