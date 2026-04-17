import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const staffRoleEnum = pgEnum("staff_role", [
  "owner",
  "admin",
  "manager",
  "finance",
  "viewer",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "applied",
  "awaiting_review",
  "awaiting_confirmation",
  "confirmed",
  "cancelled",
  "declined",
]);

export const confirmationStatusEnum = pgEnum("confirmation_status", [
  "not_required",
  "pending",
  "sent",
  "confirmed",
  "expired",
  "overridden",
]);

export const packetStatusEnum = pgEnum("packet_status", [
  "not_started",
  "sent",
  "viewed",
  "completed",
  "expired",
  "failed",
  "cancelled",
  "rejected",
]);

export const billingStatusEnum = pgEnum("billing_status", [
  "not_created",
  "open",
  "partially_paid",
  "paid",
  "voided",
  "refunded",
  "failed",
]);

export const readinessStatusEnum = pgEnum("readiness_status", [
  "not_ready",
  "ready",
  "blocked",
  "exception",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "dead_letter",
]);

export const tokenPurposeEnum = pgEnum("token_purpose", [
  "confirmation",
  "packet_access",
  "file_download",
  "insurance_upload",
]);

export const webhookProviderEnum = pgEnum("webhook_provider", [
  "docuseal",
  "documenso",
  "quickbooks",
]);

export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processed",
  "ignored",
  "failed",
]);

export const reminderTypeEnum = pgEnum("reminder_type", [
  "confirmation_pending",
  "docs_pending",
  "invoice_unpaid",
]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "insurance_card",
  "signed_packet",
  "attachment",
]);

const baseColumns = {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const staffUsers = pgTable(
  "staff_users",
  {
    ...baseColumns,
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: staffRoleEnum("role").notNull().default("viewer"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => ({
    emailIdx: uniqueIndex("staff_users_email_idx").on(table.email),
  }),
);

export const trips = pgTable(
  "trips",
  {
    ...baseColumns,
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    seasonYear: integer("season_year").notNull(),
    description: text("description").notNull().default(""),
    enrollmentOpenAt: timestamp("enrollment_open_at", { withTimezone: true }).notNull(),
    enrollmentCloseAt: timestamp("enrollment_close_at", { withTimezone: true }).notNull(),
    requiresStaffReview: boolean("requires_staff_review").notNull().default(false),
    requiresAlternateConfirmation: boolean("requires_alternate_confirmation").notNull().default(false),
    basePriceCents: integer("base_price_cents").notNull().default(0),
    invoiceDescription: text("invoice_description").notNull().default(""),
    docusealTemplateId: varchar("docuseal_template_id", { length: 120 }),
    signingTemplateId: varchar("signing_template_id", { length: 120 }),
    confirmationDeadlineDays: integer("confirmation_deadline_days").notNull().default(5),
    docsDeadlineDays: integer("docs_deadline_days").notNull().default(7),
    paymentDeadlineDays: integer("payment_deadline_days").notNull().default(14),
    reminderCadenceHours: integer("reminder_cadence_hours").notNull().default(48),
    readinessNotes: text("readiness_notes").notNull().default(""),
    isArchived: boolean("is_archived").notNull().default(false),
  },
  (table) => ({
    slugIdx: uniqueIndex("trips_slug_idx").on(table.slug),
  }),
);

export const participants = pgTable("participants", {
  ...baseColumns,
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  birthDate: timestamp("birth_date", { mode: "date" }),
  gender: varchar("gender", { length: 50 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  gradeLevel: varchar("grade_level", { length: 50 }),
  clubName: varchar("club_name", { length: 255 }),
});

export const guardians = pgTable("guardians", {
  ...baseColumns,
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  relationship: varchar("relationship", { length: 100 }).notNull().default("parent"),
  addressLine1: varchar("address_line_1", { length: 255 }).notNull().default(""),
  addressLine2: varchar("address_line_2", { length: 255 }).notNull().default(""),
  city: varchar("city", { length: 120 }).notNull().default(""),
  state: varchar("state", { length: 50 }).notNull().default(""),
  postalCode: varchar("postal_code", { length: 20 }).notNull().default(""),
});

export const enrollments = pgTable(
  "enrollments",
  {
    ...baseColumns,
    tripId: uuid("trip_id")
      .references(() => trips.id, { onDelete: "restrict" })
      .notNull(),
    participantId: uuid("participant_id")
      .references(() => participants.id, { onDelete: "restrict" })
      .notNull(),
    guardianId: uuid("guardian_id")
      .references(() => guardians.id, { onDelete: "restrict" })
      .notNull(),
    submittedByEmail: varchar("submitted_by_email", { length: 320 }).notNull(),
    alternateConfirmerEmail: varchar("alternate_confirmer_email", { length: 320 }),
    enrollmentStatus: enrollmentStatusEnum("enrollment_status").notNull().default("applied"),
    confirmationStatus: confirmationStatusEnum("confirmation_status").notNull().default("pending"),
    packetStatus: packetStatusEnum("packet_status").notNull().default("not_started"),
    billingStatus: billingStatusEnum("billing_status").notNull().default("not_created"),
    readinessStatus: readinessStatusEnum("readiness_status").notNull().default("not_ready"),
    requiresReview: boolean("requires_review").notNull().default(false),
    reviewDecisionAt: timestamp("review_decision_at", { withTimezone: true }),
    reviewDecisionBy: uuid("review_decision_by").references(() => staffUsers.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmationDueAt: timestamp("confirmation_due_at", { withTimezone: true }),
    docsDueAt: timestamp("docs_due_at", { withTimezone: true }),
    paymentDueAt: timestamp("payment_due_at", { withTimezone: true }),
    invoiceAmountCents: integer("invoice_amount_cents").notNull().default(0),
    applicationFingerprint: text("application_fingerprint"),
    paymentReceivedAt: timestamp("payment_received_at", { withTimezone: true }),
    insuranceUploadedAt: timestamp("insurance_uploaded_at", { withTimezone: true }),
    readyOverride: boolean("ready_override").notNull().default(false),
    exceptionReason: text("exception_reason"),
    latestNote: text("latest_note"),
  },
  (table) => ({
    tripIdx: index("enrollments_trip_idx").on(table.tripId),
    participantIdx: index("enrollments_participant_idx").on(table.participantId),
    applicationFingerprintIdx: uniqueIndex("enrollments_application_fingerprint_idx").on(
      table.applicationFingerprint,
    ),
  }),
);

export const tokenLinks = pgTable(
  "token_links",
  {
    ...baseColumns,
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    purpose: tokenPurposeEnum("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByIp: varchar("consumed_by_ip", { length: 64 }),
  },
  (table) => ({
    hashIdx: uniqueIndex("token_links_hash_idx").on(table.tokenHash),
  }),
);

export const confirmationRequests = pgTable("confirmation_requests", {
  ...baseColumns,
  enrollmentId: uuid("enrollment_id")
    .references(() => enrollments.id, { onDelete: "cascade" })
    .notNull(),
  tokenLinkId: uuid("token_link_id")
    .references(() => tokenLinks.id, { onDelete: "cascade" })
    .notNull(),
  recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  resendCount: integer("resend_count").notNull().default(0),
});

export const documentPackets = pgTable("document_packets", {
  ...baseColumns,
  enrollmentId: uuid("enrollment_id")
    .references(() => enrollments.id, { onDelete: "cascade" })
    .notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerSubmissionId: varchar("provider_submission_id", { length: 120 }),
  providerTemplateId: varchar("provider_template_id", { length: 120 }),
  packetStatus: packetStatusEnum("packet_status").notNull().default("not_started"),
  isCurrent: boolean("is_current").notNull().default(true),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  insuranceArtifactId: uuid("insurance_artifact_id"),
  signedPacketArtifactId: uuid("signed_packet_artifact_id"),
  lastError: text("last_error"),
},
  (table) => ({
    currentPacketPerEnrollmentIdx: uniqueIndex("document_packets_current_per_enrollment_idx")
      .on(table.enrollmentId)
      .where(sql`${table.isCurrent}`),
  }),
);

export const billingRecords = pgTable("billing_records", {
  ...baseColumns,
  enrollmentId: uuid("enrollment_id")
    .references(() => enrollments.id, { onDelete: "cascade" })
    .notNull(),
  provider: varchar("provider", { length: 50 }).notNull().default("quickbooks"),
  customerExternalId: varchar("customer_external_id", { length: 120 }),
  invoiceExternalId: varchar("invoice_external_id", { length: 120 }),
  invoiceNumber: varchar("invoice_number", { length: 120 }),
  billingStatus: billingStatusEnum("billing_status").notNull().default("not_created"),
  amountCents: integer("amount_cents").notNull().default(0),
  balanceCents: integer("balance_cents").notNull().default(0),
  invoiceUrl: text("invoice_url"),
  invoicedAt: timestamp("invoiced_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  lastError: text("last_error"),
});

export const fileArtifacts = pgTable("file_artifacts", {
  ...baseColumns,
  enrollmentId: uuid("enrollment_id").references(() => enrollments.id, {
    onDelete: "cascade",
  }),
  packetId: uuid("packet_id").references(() => documentPackets.id, {
    onDelete: "cascade",
  }),
  artifactType: artifactTypeEnum("artifact_type").notNull(),
  storageBucket: varchar("storage_bucket", { length: 120 }).notNull(),
  storagePath: text("storage_path").notNull(),
  sourceProvider: varchar("source_provider", { length: 50 }).notNull().default("internal"),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  externalReference: varchar("external_reference", { length: 120 }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reminderSends = pgTable("reminder_sends", {
  ...baseColumns,
  enrollmentId: uuid("enrollment_id")
    .references(() => enrollments.id, { onDelete: "cascade" })
    .notNull(),
  reminderType: reminderTypeEnum("reminder_type").notNull(),
  recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
},
  (table) => ({
    dedupeIdx: uniqueIndex("reminder_sends_dedupe_idx").on(table.idempotencyKey),
  }),
);

export const enrollmentNotes = pgTable("enrollment_notes", {
  ...baseColumns,
  enrollmentId: uuid("enrollment_id")
    .references(() => enrollments.id, { onDelete: "cascade" })
    .notNull(),
  authorStaffUserId: uuid("author_staff_user_id").references(() => staffUsers.id),
  body: text("body").notNull(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    ...baseColumns,
    actorType: varchar("actor_type", { length: 50 }).notNull(),
    actorId: varchar("actor_id", { length: 255 }),
    actorDisplay: varchar("actor_display", { length: 255 }).notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id),
    tripId: uuid("trip_id").references(() => trips.id),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tripIdx: index("audit_events_trip_idx").on(table.tripId),
    enrollmentIdx: index("audit_events_enrollment_idx").on(table.enrollmentId),
  }),
);

export const externalWebhookEvents = pgTable(
  "external_webhook_events",
  {
    ...baseColumns,
    provider: webhookProviderEnum("provider").notNull(),
    externalEventId: varchar("external_event_id", { length: 255 }),
    signatureValid: boolean("signature_valid").notNull().default(false),
    payload: jsonb("payload").notNull(),
    headers: jsonb("headers").notNull().default(sql`'{}'::jsonb`),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingStatus: webhookStatusEnum("processing_status").notNull().default("received"),
    lastError: text("last_error"),
  },
  (table) => ({
    providerEventIdx: uniqueIndex("external_webhook_events_provider_event_idx").on(
      table.provider,
      table.externalEventId,
    ),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    ...baseColumns,
    type: varchar("type", { length: 120 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: varchar("locked_by", { length: 120 }),
    lastError: text("last_error"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
  },
  (table) => ({
    readyIdx: index("jobs_ready_idx").on(table.status, table.runAt),
    idempotencyIdx: uniqueIndex("jobs_idempotency_idx").on(table.idempotencyKey),
  }),
);
