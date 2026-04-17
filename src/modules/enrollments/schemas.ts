import { z } from "zod";

export const applicationSchema = z.object({
  tripSlug: z.string().min(1),
  participantFirstName: z.string().min(2),
  participantLastName: z.string().min(2),
  participantBirthDate: z.string().optional(),
  participantEmail: z.string().email().optional().or(z.literal("")),
  participantPhone: z.string().optional(),
  participantGradeLevel: z.string().optional(),
  participantClubName: z.string().optional(),
  guardianFirstName: z.string().min(2),
  guardianLastName: z.string().min(2),
  guardianEmail: z.string().email(),
  guardianPhone: z.string().min(7),
  guardianRelationship: z.string().min(2),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(5),
  alternateConfirmerEmail: z.string().email().optional().or(z.literal("")),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
