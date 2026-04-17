import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  enrollments,
  externalWebhookEvents,
  guardians,
  jobs,
  participants,
  reminderSends,
  staffUsers,
  trips,
} from "@/lib/db/schema";
import { createTestDb } from "../helpers/pglite";

describe("database schema", () => {
  it("persists a trip and enrollment graph", async () => {
    const { db, client } = await createTestDb();

    await db.insert(staffUsers).values({
      id: randomUUID(),
      email: "staff@example.org",
      name: "Staff User",
      role: "admin",
    });

    const tripId = randomUUID();
    const participantId = randomUUID();
    const guardianId = randomUUID();
    const enrollmentId = randomUUID();

    await db.insert(trips).values({
      id: tripId,
      name: "Summer Tour",
      slug: "summer-tour",
      seasonYear: 2026,
      description: "Summer competition travel.",
      enrollmentOpenAt: new Date("2026-01-01T00:00:00Z"),
      enrollmentCloseAt: new Date("2026-06-01T00:00:00Z"),
      invoiceDescription: "Summer Tour invoice",
    });
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
    await db.insert(enrollments).values({
      id: enrollmentId,
      tripId,
      participantId,
      guardianId,
      submittedByEmail: "guardian@example.org",
    });

    const enrollment = await db.query.enrollments.findFirst({
      where: eq(enrollments.id, enrollmentId),
    });

    expect(enrollment?.submittedByEmail).toBe("guardian@example.org");
    await client.close();
  });

  it("enforces unique idempotency keys for jobs", async () => {
    const { db, client } = await createTestDb();

    await db.insert(jobs).values({
      id: randomUUID(),
      type: "send_reminder",
      payload: {},
      idempotencyKey: "job-key-1",
    });

    await expect(
      db.insert(jobs).values({
        id: randomUUID(),
        type: "send_reminder",
        payload: {},
        idempotencyKey: "job-key-1",
      }),
    ).rejects.toThrow();

    await client.close();
  });

  it("rejects duplicate webhook provider event ids", async () => {
    const { db, client } = await createTestDb();

    await db.insert(externalWebhookEvents).values({
      id: randomUUID(),
      provider: "docuseal",
      externalEventId: "evt_1",
      signatureValid: true,
      payload: {},
      headers: {},
    });

    await expect(
      db.insert(externalWebhookEvents).values({
        id: randomUUID(),
        provider: "docuseal",
        externalEventId: "evt_1",
        signatureValid: true,
        payload: {},
        headers: {},
      }),
    ).rejects.toThrow();

    await client.close();
  });

  it("deduplicates reminder sends through a unique key", async () => {
    const { db, client } = await createTestDb();
    const tripId = randomUUID();
    const participantId = randomUUID();
    const guardianId = randomUUID();
    const enrollmentId = randomUUID();

    await db.insert(trips).values({
      id: tripId,
      name: "Summer Tour",
      slug: "summer-tour-2",
      seasonYear: 2026,
      description: "Summer competition travel.",
      enrollmentOpenAt: new Date("2026-01-01T00:00:00Z"),
      enrollmentCloseAt: new Date("2026-06-01T00:00:00Z"),
      invoiceDescription: "Summer Tour invoice",
    });
    await db.insert(participants).values({
      id: participantId,
      firstName: "Pat",
      lastName: "Athlete",
    });
    await db.insert(guardians).values({
      id: guardianId,
      firstName: "Alex",
      lastName: "Guardian",
      email: "alex@example.org",
    });
    await db.insert(enrollments).values({
      id: enrollmentId,
      tripId,
      participantId,
      guardianId,
      submittedByEmail: "alex@example.org",
    });

    await db.insert(reminderSends).values({
      id: randomUUID(),
      enrollmentId,
      reminderType: "docs_pending",
      recipientEmail: "alex@example.org",
      idempotencyKey: "reminder-1",
    });

    await expect(
      db.insert(reminderSends).values({
        id: randomUUID(),
        enrollmentId,
        reminderType: "docs_pending",
        recipientEmail: "alex@example.org",
        idempotencyKey: "reminder-1",
      }),
    ).rejects.toThrow();

    await client.close();
  });
});
