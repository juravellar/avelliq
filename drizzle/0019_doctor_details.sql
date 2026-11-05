ALTER TABLE "doctors" ADD COLUMN "crm_number" text;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "crm_state" text;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "rqe" text;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "accepts_private" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "health_insurances" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "doctors_clinic_crm_unique" ON "doctors" USING btree ("clinic_id","crm_state","crm_number") WHERE "doctors"."crm_number" is not null;