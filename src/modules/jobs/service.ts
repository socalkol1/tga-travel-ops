import { eq, sql } from "drizzle-orm";

import { db, type DbExecutor } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";

export type JobPayload = Record<string, unknown>;

export async function enqueueJob(input: {
  type: string;
  payload: JobPayload;
  runAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string;
  executor?: DbExecutor;
}) {
  const executor = input.executor ?? db;
  const baseInsert = executor
    .insert(jobs)
    .values({
      type: input.type,
      payload: input.payload,
      runAt: input.runAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 8,
      idempotencyKey: input.idempotencyKey ?? null,
    });

  const created = input.idempotencyKey
    ? await baseInsert.onConflictDoNothing({ target: jobs.idempotencyKey }).returning()
    : await baseInsert.returning();

  if (created[0]) {
    return created[0];
  }

  if (!input.idempotencyKey) {
    throw new Error("Unable to enqueue job");
  }

  const existing = await executor.execute(sql`
    select *
    from jobs
    where idempotency_key = ${input.idempotencyKey}
    limit 1
  `);

  const row = Array.from(existing)[0] as typeof jobs.$inferSelect | undefined;

  if (!row) {
    throw new Error("Unable to load existing job");
  }

  return {
    ...row,
    payload: (row.payload ?? {}) as Record<string, unknown>,
  };
}

export async function claimDueJobs(limit: number, workerId: string) {
  const result = await db.execute(sql`
    with claimed as (
      select id
      from jobs
      where status = 'pending'
        and run_at <= now()
      order by run_at asc
      for update skip locked
      limit ${limit}
    )
    update jobs
    set
      status = 'running',
      locked_at = now(),
      locked_by = ${workerId},
      attempts = attempts + 1,
      updated_at = now()
    from claimed
    where jobs.id = claimed.id
    returning jobs.*
  `);

  return Array.from(result).map((row) => ({
    ...(row as typeof jobs.$inferSelect),
    payload: ((row as typeof jobs.$inferSelect).payload ?? {}) as Record<string, unknown>,
  }));
}

export async function markJobComplete(id: string) {
  await db
    .update(jobs)
    .set({
      status: "completed",
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
      lastError: null,
    })
    .where(eq(jobs.id, id));
}

export async function markJobFailed(job: typeof jobs.$inferSelect, error: unknown) {
  const attemptsExceeded = job.attempts >= job.maxAttempts;
  const backoffMinutes = Math.min(60, 2 ** Math.max(job.attempts - 1, 0));

  await db
    .update(jobs)
    .set({
      status: attemptsExceeded ? "dead_letter" : "pending",
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
      runAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
      lastError: error instanceof Error ? error.message : String(error),
    })
    .where(eq(jobs.id, job.id));
}

export async function listFailedJobs() {
  return db.query.jobs.findMany({
    where: eq(jobs.status, "dead_letter"),
  });
}
