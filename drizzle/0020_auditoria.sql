CREATE TABLE "support_deleted_emails" (
	"resend_email_id_hash" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_inbox_sync" (
	"key" text PRIMARY KEY NOT NULL,
	"last_synced_at" timestamp NOT NULL
);
--> statement-breakpoint
-- Moderator ids that no longer point to a user would make the constraints fail.
UPDATE "users" SET "blocked_by" = NULL WHERE "blocked_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "users"."blocked_by");--> statement-breakpoint
UPDATE "users" SET "deletion_requested_by" = NULL WHERE "deletion_requested_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "users"."deletion_requested_by");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deletion_requested_by_users_id_fk" FOREIGN KEY ("deletion_requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Plain CREATE INDEX blocks writes to the table while it builds. These tables
-- are small today, so it finishes well inside the migration lock_timeout.
CREATE INDEX "appointments_clinic_date_idx" ON "appointments" USING btree ("clinic_id","date");--> statement-breakpoint
CREATE INDEX "appointments_patient_id_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "doctors_clinic_id_idx" ON "doctors" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "patients_clinic_id_idx" ON "patients" USING btree ("clinic_id");