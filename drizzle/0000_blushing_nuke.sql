CREATE TABLE "awkn_investor_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "awkn_investor_allowlist" (
	"email" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "awkn_investor_passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp with time zone,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "awkn_investor_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "awkn_investor_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "awkn_investor_two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "awkn_investor_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "awkn_investor_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "awkn_investor_account" ADD CONSTRAINT "awkn_investor_account_user_id_awkn_investor_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."awkn_investor_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awkn_investor_passkey" ADD CONSTRAINT "awkn_investor_passkey_user_id_awkn_investor_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."awkn_investor_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awkn_investor_session" ADD CONSTRAINT "awkn_investor_session_user_id_awkn_investor_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."awkn_investor_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awkn_investor_two_factor" ADD CONSTRAINT "awkn_investor_two_factor_user_id_awkn_investor_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."awkn_investor_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "awkn_investor_account_user_idx" ON "awkn_investor_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "awkn_investor_rate_limit_key_idx" ON "awkn_investor_rate_limit" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "awkn_investor_session_token_idx" ON "awkn_investor_session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "awkn_investor_session_user_idx" ON "awkn_investor_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "awkn_investor_user_email_idx" ON "awkn_investor_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "awkn_investor_verification_identifier_idx" ON "awkn_investor_verification" USING btree ("identifier");