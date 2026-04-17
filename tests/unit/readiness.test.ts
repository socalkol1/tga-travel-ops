import { describe, expect, it } from "vitest";

import { calculateReadiness } from "@/lib/security/readiness";

describe("calculateReadiness", () => {
  it("returns ready when all requirements are complete", () => {
    expect(
      calculateReadiness({
        confirmationStatus: "confirmed",
        packetStatus: "completed",
        billingStatus: "paid",
        insuranceUploadedAt: new Date(),
      }),
    ).toBe("ready");
  });

  it("returns blocked for failed dependent statuses", () => {
    expect(
      calculateReadiness({
        confirmationStatus: "confirmed",
        packetStatus: "failed",
        billingStatus: "open",
      }),
    ).toBe("blocked");
  });

  it("returns exception when an exception reason exists", () => {
    expect(
      calculateReadiness({
        confirmationStatus: "pending",
        packetStatus: "not_started",
        billingStatus: "not_created",
        exceptionReason: "Medical exception",
      }),
    ).toBe("exception");
  });
});
