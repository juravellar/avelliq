CREATE TABLE "support_deleted_emails" (
	"resend_email_id_hash" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
