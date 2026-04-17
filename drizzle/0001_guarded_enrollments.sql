ALTER TABLE "enrollments" ADD COLUMN "application_fingerprint" text;--> statement-breakpoint
UPDATE "enrollments" AS e
SET "application_fingerprint" = lower(concat_ws(
  '::',
  e."trip_id"::text,
  g."email",
  p."first_name",
  p."last_name"
))
FROM "guardians" AS g, "participants" AS p
WHERE g."id" = e."guardian_id"
  AND p."id" = e."participant_id";--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_application_fingerprint_idx" ON "enrollments" USING btree ("application_fingerprint");--> statement-breakpoint
