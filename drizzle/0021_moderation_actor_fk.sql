-- Moderator ids that no longer point to a user would make the constraints fail.
UPDATE "users" SET "blocked_by" = NULL WHERE "blocked_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "users"."blocked_by");--> statement-breakpoint
UPDATE "users" SET "deletion_requested_by" = NULL WHERE "deletion_requested_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "users"."deletion_requested_by");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deletion_requested_by_users_id_fk" FOREIGN KEY ("deletion_requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
