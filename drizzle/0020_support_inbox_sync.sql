CREATE TABLE "support_inbox_sync" (
	"key" text PRIMARY KEY NOT NULL,
	"last_synced_at" timestamp NOT NULL
);
--> statement-breakpoint
-- Plain CREATE INDEX blocks writes to the table while it builds. These tables
-- are small today, so it finishes well inside the migration lock_timeout.
CREATE INDEX "appointments_clinic_date_idx" ON "appointments" USING btree ("clinic_id","date");--> statement-breakpoint
CREATE INDEX "appointments_patient_id_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "doctors_clinic_id_idx" ON "doctors" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "patients_clinic_id_idx" ON "patients" USING btree ("clinic_id");