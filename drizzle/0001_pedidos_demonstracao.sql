CREATE TABLE "demo_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"company" text NOT NULL,
	"city" text,
	"subscribers" text,
	"erp" text,
	"email" text NOT NULL,
	"whatsapp" text NOT NULL,
	"message" text,
	"email_status" text DEFAULT 'not_configured' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "demo_requests_created_idx" ON "demo_requests" USING btree ("created_at");