import { addHours, isAfter } from "date-fns";

import type { reminderTypeEnum } from "@/lib/db/schema";

type ReminderType = (typeof reminderTypeEnum.enumValues)[number];

export type ReminderDecisionInput = {
  now: Date;
  cadenceHours: number;
  dueAt?: Date | null;
  lastSentAt?: Date | null;
  isCompleted: boolean;
};

export function shouldSendReminder({
  now,
  cadenceHours,
  dueAt,
  lastSentAt,
  isCompleted,
}: ReminderDecisionInput) {
  if (isCompleted) {
    return false;
  }

  if (!lastSentAt) {
    return true;
  }

  const nextEligibleAt = addHours(lastSentAt, cadenceHours);

  if (isAfter(nextEligibleAt, now)) {
    return false;
  }

  if (dueAt && isAfter(now, addHours(dueAt, 24 * 7))) {
    return false;
  }

  return true;
}

export function buildReminderIdempotencyKey(args: {
  enrollmentId: string;
  type: ReminderType;
  dayStamp: string;
}) {
  return `${args.enrollmentId}:${args.type}:${args.dayStamp}`;
}
