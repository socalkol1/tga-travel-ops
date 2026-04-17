import { db, type DbExecutor } from "@/lib/db/client";
import { auditEvents } from "@/lib/db/schema";

export async function recordAuditEvent(input: {
  actorType: string;
  actorId?: string | null;
  actorDisplay: string;
  action: string;
  enrollmentId?: string | null;
  tripId?: string | null;
  metadata?: Record<string, unknown>;
  executor?: DbExecutor;
}) {
  const executor = input.executor ?? db;

  await executor.insert(auditEvents).values({
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    actorDisplay: input.actorDisplay,
    action: input.action,
    enrollmentId: input.enrollmentId ?? null,
    tripId: input.tripId ?? null,
    metadata: input.metadata ?? {},
  });
}
