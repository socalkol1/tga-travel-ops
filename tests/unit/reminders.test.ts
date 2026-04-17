import { describe, expect, it } from "vitest";

import { buildReminderIdempotencyKey, shouldSendReminder } from "@/lib/security/reminders";

describe("reminder logic", () => {
  it("sends when there is no prior reminder and the item is incomplete", () => {
    expect(
      shouldSendReminder({
        now: new Date("2026-04-14T12:00:00Z"),
        cadenceHours: 48,
        isCompleted: false,
      }),
    ).toBe(true);
  });

  it("does not send when cadence has not elapsed", () => {
    expect(
      shouldSendReminder({
        now: new Date("2026-04-14T12:00:00Z"),
        cadenceHours: 48,
        lastSentAt: new Date("2026-04-13T12:00:00Z"),
        isCompleted: false,
      }),
    ).toBe(false);
  });

  it("builds deterministic idempotency keys", () => {
    expect(
      buildReminderIdempotencyKey({
        enrollmentId: "enr_123",
        type: "docs_pending",
        dayStamp: "2026-04-14",
      }),
    ).toBe("enr_123:docs_pending:2026-04-14");
  });
});
