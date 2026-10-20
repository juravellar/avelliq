CREATE TYPE "public"."staff_role" AS ENUM('support', 'admin');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_role" "staff_role";--> statement-breakpoint
-- Admins until now only answered the Atendimento, which is the support role.
UPDATE "users" SET "staff_role" = 'support' WHERE "support_admin" = true;
