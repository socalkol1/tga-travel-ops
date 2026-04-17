import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { recordAuditEvent } from "@/modules/audit/service";
import type { TripInput } from "@/modules/trips/schemas";

export class TripNotAcceptingApplicationsError extends Error {
  code = "trip_not_accepting_applications" as const;

  constructor() {
    super("Trip is not accepting applications");
  }
}

export type TripApplicationState =
  | "open"
  | "not_yet_open"
  | "closed"
  | "archived";

export async function listTrips(options?: { includeArchived?: boolean }) {
  return db.query.trips.findMany({
    where: options?.includeArchived ? undefined : eq(trips.isArchived, false),
    orderBy: [asc(trips.enrollmentOpenAt)],
  });
}

export async function getTripBySlug(
  slug: string,
  options?: { includeArchived?: boolean },
) {
  return db.query.trips.findFirst({
    where: options?.includeArchived
      ? eq(trips.slug, slug)
      : and(eq(trips.slug, slug), eq(trips.isArchived, false)),
  });
}

export async function getTripById(id: string) {
  return db.query.trips.findFirst({
    where: eq(trips.id, id),
  });
}

export async function upsertTrip(input: TripInput & { id?: string }, actor: {
  id?: string;
  display: string;
}) {
  if (input.id) {
    const updated = await db
      .update(trips)
      .set({
        ...input,
        enrollmentOpenAt: new Date(input.enrollmentOpenAt),
        enrollmentCloseAt: new Date(input.enrollmentCloseAt),
        updatedAt: new Date(),
      })
      .where(eq(trips.id, input.id))
      .returning();

    await recordAuditEvent({
      actorType: "staff",
      actorId: actor.id,
      actorDisplay: actor.display,
      action: "trip.updated",
      tripId: input.id,
      metadata: { slug: input.slug },
    });

    return updated[0];
  }

  const inserted = await db
    .insert(trips)
    .values({
      ...input,
      enrollmentOpenAt: new Date(input.enrollmentOpenAt),
      enrollmentCloseAt: new Date(input.enrollmentCloseAt),
    })
    .returning();

  await recordAuditEvent({
    actorType: "staff",
    actorId: actor.id,
    actorDisplay: actor.display,
    action: "trip.created",
    tripId: inserted[0].id,
    metadata: { slug: input.slug },
  });

  return inserted[0];
}

export async function archiveTrip(id: string, actor: { id?: string; display: string }) {
  await db.update(trips).set({ isArchived: true, updatedAt: new Date() }).where(eq(trips.id, id));

  await recordAuditEvent({
    actorType: "staff",
    actorId: actor.id,
    actorDisplay: actor.display,
    action: "trip.archived",
    tripId: id,
  });
}

export function getTripApplicationState(
  trip: typeof trips.$inferSelect,
  now = new Date(),
): TripApplicationState {
  if (trip.isArchived) {
    return "archived";
  }

  if (trip.enrollmentOpenAt > now) {
    return "not_yet_open";
  }

  if (trip.enrollmentCloseAt < now) {
    return "closed";
  }

  return "open";
}

export function canTripAcceptApplications(
  trip: typeof trips.$inferSelect,
  now = new Date(),
) {
  return getTripApplicationState(trip, now) === "open";
}

export function assertTripAcceptingApplications(
  trip: typeof trips.$inferSelect,
  now = new Date(),
) {
  if (!canTripAcceptApplications(trip, now)) {
    throw new TripNotAcceptingApplicationsError();
  }
}
