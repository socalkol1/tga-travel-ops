import { describe, expect, it } from "vitest";

import { buildReminderIdempotencyKey } from "@/lib/security/reminders";

describe("idempotency keys", () => {
  it("changes across day boundaries", () => {
    const one = buildReminderIdempotencyKey({
      enrollmentId: "enr_1",
      type: "invoice_unpaid",
      dayStamp: "2026-04-14",
    });
    const two = buildReminderIdempotencyKey({
      enrollmentId: "enr_1",
      type: "invoice_unpaid",
      dayStamp: "2026-04-15",
    });

    expect(one).not.toBe(two);
  });
});
