ALTER TYPE "public"."packet_status" ADD VALUE IF NOT EXISTS 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."packet_status" ADD VALUE IF NOT EXISTS 'rejected';--> statement-breakpoint
ALTER TYPE "public"."token_purpose" ADD VALUE IF NOT EXISTS 'insurance_upload';--> statement-breakpoint
ALTER TYPE "public"."webhook_provider" ADD VALUE IF NOT EXISTS 'documenso';--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "signing_template_id" varchar(120);--> statement-breakpoint
UPDATE "trips" SET "signing_template_id" = "docuseal_template_id" WHERE "signing_template_id" IS NULL;--> statement-breakpoint
ALTER TABLE "document_packets" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "document_packets" ALTER COLUMN "provider" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "document_packets_current_per_enrollment_idx" ON "document_packets" USING btree ("enrollment_id") WHERE "is_current";--> statement-breakpoint
