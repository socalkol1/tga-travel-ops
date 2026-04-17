import type { billingStatusEnum, confirmationStatusEnum, packetStatusEnum } from "@/lib/db/schema";

type ConfirmationStatus = (typeof confirmationStatusEnum.enumValues)[number];
type PacketStatus = (typeof packetStatusEnum.enumValues)[number];
type BillingStatus = (typeof billingStatusEnum.enumValues)[number];

export type ReadinessInput = {
  confirmationStatus: ConfirmationStatus;
  packetStatus: PacketStatus;
  billingStatus: BillingStatus;
  insuranceUploadedAt?: Date | null;
  readyOverride?: boolean;
  exceptionReason?: string | null;
};

export function calculateReadiness({
  confirmationStatus,
  packetStatus,
  billingStatus,
  insuranceUploadedAt,
  readyOverride,
  exceptionReason,
}: ReadinessInput) {
  if (exceptionReason) {
    return "exception" as const;
  }

  if (readyOverride) {
    return "ready" as const;
  }

  const isConfirmed = confirmationStatus === "confirmed" || confirmationStatus === "overridden";
  const docsComplete = packetStatus === "completed";
  const billingComplete = billingStatus === "paid";
  const insuranceComplete = Boolean(insuranceUploadedAt);

  if (isConfirmed && docsComplete && billingComplete && insuranceComplete) {
    return "ready" as const;
  }

  if (
    confirmationStatus === "expired" ||
    packetStatus === "failed" ||
    packetStatus === "expired" ||
    packetStatus === "cancelled" ||
    packetStatus === "rejected" ||
    billingStatus === "failed"
  ) {
    return "blocked" as const;
  }

  return "not_ready" as const;
}
