import { z } from "zod";

export const tripSchema = z.object({
  name: z.string().min(3).max(255),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
  seasonYear: z.coerce.number().int().min(2024).max(2100),
  description: z.string().min(10),
  enrollmentOpenAt: z.string().datetime(),
  enrollmentCloseAt: z.string().datetime(),
  requiresStaffReview: z.coerce.boolean().default(false),
  requiresAlternateConfirmation: z.coerce.boolean().default(false),
  basePriceCents: z.coerce.number().int().nonnegative(),
  invoiceDescription: z.string().min(3),
  signingTemplateId: z.string().optional().nullable(),
  confirmationDeadlineDays: z.coerce.number().int().positive().default(5),
  docsDeadlineDays: z.coerce.number().int().positive().default(7),
  paymentDeadlineDays: z.coerce.number().int().positive().default(14),
  reminderCadenceHours: z.coerce.number().int().positive().default(48),
  readinessNotes: z.string().default(""),
});

export type TripInput = z.infer<typeof tripSchema>;
