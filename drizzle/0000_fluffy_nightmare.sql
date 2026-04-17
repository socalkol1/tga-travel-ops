CREATE TYPE "public"."artifact_type" AS ENUM('insurance_card', 'signed_packet', 'attachment');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('not_created', 'open', 'partially_paid', 'paid', 'voided', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."confirmation_status" AS ENUM('not_required', 'pending', 'sent', 'confirmed', 'expired', 'overridden');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('applied', 'awaiting_review', 'awaiting_confirmation', 'confirmed', 'cancelled', 'declined');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."packet_status" AS ENUM('not_started', 'sent', 'viewed', 'completed', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."readiness_status" AS ENUM('not_ready', 'ready', 'blocked', 'exception');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('confirmation_pending', 'docs_pending', 'invoice_unpaid');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('owner', 'admin', 'manager', 'finance', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('confirmation', 'packet_access', 'file_download');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('docuseal', 'quickbooks');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" varchar(50) NOT NULL,
	"actor_id" varchar(255),
	"actor_display" varchar(255) NOT NULL,
	"action" varchar(120) NOT NULL,
	"enrollment_id" uuid,
	"trip_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"provider" varchar(50) DEFAULT 'quickbooks' NOT NULL,
	"customer_external_id" varchar(120),
	"invoice_external_id" varchar(120),
	"invoice_number" varchar(120),
	"billing_status" "billing_status" DEFAULT 'not_created' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"invoice_url" text,
	"invoiced_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "confirmation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"token_link_id" uuid NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"resend_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"provider" varchar(50) DEFAULT 'docuseal' NOT NULL,
	"provider_submission_id" varchar(120),
	"provider_template_id" varchar(120),
	"packet_status" "packet_status" DEFAULT 'not_started' NOT NULL,
	"last_sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"insurance_artifact_id" uuid,
	"signed_packet_artifact_id" uuid,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "enrollment_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"author_staff_user_id" uuid,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"submitted_by_email" varchar(320) NOT NULL,
	"alternate_confirmer_email" varchar(320),
	"enrollment_status" "enrollment_status" DEFAULT 'applied' NOT NULL,
	"confirmation_status" "confirmation_status" DEFAULT 'pending' NOT NULL,
	"packet_status" "packet_status" DEFAULT 'not_started' NOT NULL,
	"billing_status" "billing_status" DEFAULT 'not_created' NOT NULL,
	"readiness_status" "readiness_status" DEFAULT 'not_ready' NOT NULL,
	"requires_review" boolean DEFAULT false NOT NULL,
	"review_decision_at" timestamp with time zone,
	"review_decision_by" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmation_due_at" timestamp with time zone,
	"docs_due_at" timestamp with time zone,
	"payment_due_at" timestamp with time zone,
	"invoice_amount_cents" integer DEFAULT 0 NOT NULL,
	"payment_received_at" timestamp with time zone,
	"insurance_uploaded_at" timestamp with time zone,
	"ready_override" boolean DEFAULT false NOT NULL,
	"exception_reason" text,
	"latest_note" text
);
--> statement-breakpoint
CREATE TABLE "external_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"external_event_id" varchar(255),
	"signature_valid" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_status" "webhook_status" DEFAULT 'received' NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "file_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid,
	"packet_id" uuid,
	"artifact_type" "artifact_type" NOT NULL,
	"storage_bucket" varchar(120) NOT NULL,
	"storage_path" text NOT NULL,
	"source_provider" varchar(50) DEFAULT 'internal' NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"external_reference" varchar(120),
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(50),
	"relationship" varchar(100) DEFAULT 'parent' NOT NULL,
	"address_line_1" varchar(255) DEFAULT '' NOT NULL,
	"address_line_2" varchar(255) DEFAULT '' NOT NULL,
	"city" varchar(120) DEFAULT '' NOT NULL,
	"state" varchar(50) DEFAULT '' NOT NULL,
	"postal_code" varchar(20) DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" varchar(120) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(120),
	"last_error" text,
	"idempotency_key" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"birth_date" timestamp,
	"gender" varchar(50),
	"email" varchar(320),
	"phone" varchar(50),
	"grade_level" varchar(50),
	"club_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "reminder_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"reminder_type" "reminder_type" NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "staff_role" DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "token_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_ip" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"season_year" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enrollment_open_at" timestamp with time zone NOT NULL,
	"enrollment_close_at" timestamp with time zone NOT NULL,
	"requires_staff_review" boolean DEFAULT false NOT NULL,
	"requires_alternate_confirmation" boolean DEFAULT false NOT NULL,
	"base_price_cents" integer DEFAULT 0 NOT NULL,
	"invoice_description" text DEFAULT '' NOT NULL,
	"docuseal_template_id" varchar(120),
	"confirmation_deadline_days" integer DEFAULT 5 NOT NULL,
	"docs_deadline_days" integer DEFAULT 7 NOT NULL,
	"payment_deadline_days" integer DEFAULT 14 NOT NULL,
	"reminder_cadence_hours" integer DEFAULT 48 NOT NULL,
	"readiness_notes" text DEFAULT '' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmation_requests" ADD CONSTRAINT "confirmation_requests_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmation_requests" ADD CONSTRAINT "confirmation_requests_token_link_id_token_links_id_fk" FOREIGN KEY ("token_link_id") REFERENCES "public"."token_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_packets" ADD CONSTRAINT "document_packets_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_notes" ADD CONSTRAINT "enrollment_notes_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_notes" ADD CONSTRAINT "enrollment_notes_author_staff_user_id_staff_users_id_fk" FOREIGN KEY ("author_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_review_decision_by_staff_users_id_fk" FOREIGN KEY ("review_decision_by") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_artifacts" ADD CONSTRAINT "file_artifacts_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_artifacts" ADD CONSTRAINT "file_artifacts_packet_id_document_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."document_packets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_sends" ADD CONSTRAINT "reminder_sends_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_links" ADD CONSTRAINT "token_links_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_trip_idx" ON "audit_events" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "audit_events_enrollment_idx" ON "audit_events" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "enrollments_trip_idx" ON "enrollments" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "enrollments_participant_idx" ON "enrollments" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_webhook_events_provider_event_idx" ON "external_webhook_events" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "jobs_ready_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_idempotency_idx" ON "jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_sends_dedupe_idx" ON "reminder_sends" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_users_email_idx" ON "staff_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "token_links_hash_idx" ON "token_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_slug_idx" ON "trips" USING btree ("slug");