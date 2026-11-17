CREATE TABLE "usage_records" (
	"provider_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"day" date NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_records_customer_id_day_pk" PRIMARY KEY("customer_id","day")
);
--> statement-breakpoint
ALTER TABLE "demo_requests" ADD COLUMN "segment" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "segment" text DEFAULT 'provedor' NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_records_provider_day_idx" ON "usage_records" USING btree ("provider_id","day");