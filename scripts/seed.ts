import { db } from "@/lib/db/client";
import { staffUsers, trips } from "@/lib/db/schema";

async function main() {
  const [trip] = await db
    .insert(trips)
    .values({
      name: "Summer Tour 2026",
      slug: "summer-tour-2026",
      seasonYear: 2026,
      description: "Multi-stop summer wrestler travel program with packet + billing workflow.",
      enrollmentOpenAt: new Date("2026-04-01T00:00:00Z"),
      enrollmentCloseAt: new Date("2026-06-01T00:00:00Z"),
      requiresStaffReview: false,
      requiresAlternateConfirmation: true,
      basePriceCents: 125000,
      invoiceDescription: "Summer Tour 2026",
      signingTemplateId: "fake-template-summer-2026",
    })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(staffUsers)
    .values({
      email: process.env.AUTH_DEV_USER_EMAIL ?? "staff@example.org",
      name: process.env.AUTH_DEV_USER_NAME ?? "Local Staff",
      role: "owner",
    })
    .onConflictDoNothing();

  console.log("Seed complete", trip?.slug ?? "existing");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
