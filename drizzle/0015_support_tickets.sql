CREATE TYPE "public"."support_author" AS ENUM('customer', 'team', 'system');--> statement-breakpoint
CREATE TYPE "public"."support_source" AS ENUM('email', 'form');--> statement-breakpoint
CREATE TYPE "public"."support_status" AS ENUM('received', 'in_review', 'concluded', 'archived');--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author" "support_author" NOT NULL,
	"user_id" text,
	"body" text,
	"status_change" "support_status",
	"resend_email_id" text,
	"message_id" text,
	"had_attachments" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_resend_email_id_unique" UNIQUE("resend_email_id")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "support_tickets_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"subject" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_name" text,
	"inbox" text NOT NULL,
	"source" "support_source" NOT NULL,
	"status" "support_status" DEFAULT 'received' NOT NULL,
	"context" text,
	"previous_ticket_id" uuid,
	"awaiting_team" boolean DEFAULT true NOT NULL,
	"last_message_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "support_tickets_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_previous_ticket_id_support_tickets_id_fk" FOREIGN KEY ("previous_ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_messages_ticket_created_idx" ON "support_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "support_messages_message_id_idx" ON "support_messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "support_tickets_last_message_idx" ON "support_tickets" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "support_tickets_customer_email_idx" ON "support_tickets" USING btree ("customer_email");