CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_number" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "accounts_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"description" text NOT NULL,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "buttons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"button_type" text DEFAULT 'button' NOT NULL,
	"variant" text DEFAULT 'default',
	"size" text DEFAULT 'default',
	"object_type" text NOT NULL,
	"action" text DEFAULT 'create' NOT NULL,
	"icon" text,
	"tooltip" text,
	"sort_order" integer DEFAULT 0,
	"feature_id" uuid,
	"required_permission" text,
	"required_object_type" text,
	"required_object_action" text DEFAULT 'create',
	"is_active" boolean DEFAULT true,
	"is_system_button" boolean DEFAULT false,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "buttons_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"currency" text NOT NULL,
	"currency_symbol" text NOT NULL,
	"tva" numeric(5, 2) DEFAULT '0.00',
	"is_active" boolean DEFAULT true,
	"is_ohada" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"name_en" text,
	"description" text,
	"description_en" text,
	"category" text NOT NULL,
	"icon" text,
	"is_active" boolean DEFAULT true,
	"is_premium" boolean DEFAULT false,
	"is_beta" boolean DEFAULT false,
	"required_plan" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "features_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"entry_date" date NOT NULL,
	"description" text,
	"reference" text,
	"validated" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid,
	"account_id" uuid,
	"debit" numeric(12, 2) DEFAULT '0',
	"credit" numeric(12, 2) DEFAULT '0',
	"description" text
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"unit_id" uuid,
	"tenant_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date,
	"rent_amount" numeric(12, 2),
	"deposit_paid" boolean DEFAULT false,
	"signed" boolean DEFAULT false,
	"signature_url" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"sender_type" text,
	"sender_id" uuid,
	"content" text,
	"attachments" text[],
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "navigation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"href" text NOT NULL,
	"icon" text,
	"badge_count" integer,
	"sort_order" integer DEFAULT 0,
	"feature_id" uuid,
	"required_permission" text,
	"required_object_type" text,
	"required_object_action" text DEFAULT 'read',
	"parent_key" text,
	"is_active" boolean DEFAULT true,
	"is_system_item" boolean DEFAULT false,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "navigation_items_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"user_id" uuid,
	"type" text NOT NULL,
	"channel" text,
	"content" text,
	"status" text,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "object_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_key" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"database_table" text,
	"ownership_field" text,
	"sensitive_fields" jsonb DEFAULT '[]',
	"icon" text,
	"category" text,
	"is_active" boolean DEFAULT true,
	"is_system" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" uuid,
	CONSTRAINT "object_definitions_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "organization_navigation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"navigation_item_key" text NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"is_visible" boolean DEFAULT true,
	"custom_name" text,
	"custom_icon" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"slug" text,
	"type" text DEFAULT 'individual',
	"country" text DEFAULT 'SN' NOT NULL,
	"contact_email" text,
	"phone" text,
	"phone2" text,
	"phone_verified" boolean DEFAULT false,
	"address" text,
	"city" text,
	"postal_code" text,
	"state" text,
	"extranet_tenants_count" integer DEFAULT 0,
	"custom_extranet_domain" text,
	"subdomain" text,
	"stripe_customer_id" text,
	"is_configured" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "owner_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"owner_id" uuid,
	"unit_id" uuid,
	"property_id" uuid,
	"payment_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"commission_amount" numeric(12, 2) DEFAULT '0',
	"due_date" date NOT NULL,
	"status" text DEFAULT 'scheduled',
	"transfer_method" text,
	"transfer_reference" text,
	"transferred_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"property_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"bank_account" text,
	"bank_name" text,
	"commission_rate" numeric(5, 2) DEFAULT '20.00',
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"provider" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"visible_to_tenants" boolean DEFAULT true,
	"config" jsonb DEFAULT '{}'::jsonb,
	"fee_type" text DEFAULT 'none',
	"fee_value" numeric(8, 4) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"unit_id" uuid,
	"payment_method_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"fee_amount" numeric(12, 2) DEFAULT '0',
	"status" text DEFAULT 'pending',
	"transaction_id" text,
	"gateway_response" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plan_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"feature_name" text NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"display_name_en" text,
	"description" text,
	"description_en" text,
	"price" numeric(10, 2),
	"price_type" text DEFAULT 'fixed',
	"yearly_discount_rate" numeric(5, 2),
	"max_properties" integer,
	"lots_limit" integer,
	"users_limit" integer,
	"extranet_tenants_limit" integer,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"support_level" text DEFAULT 'community',
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "profile_buttons" (
	"profile_id" uuid NOT NULL,
	"button_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"is_visible" boolean DEFAULT true,
	"custom_label" text,
	"custom_icon" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "profile_buttons_pkey" PRIMARY KEY("profile_id","button_id")
);
--> statement-breakpoint
CREATE TABLE "profile_navigation_items" (
	"profile_id" uuid NOT NULL,
	"navigation_item_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"is_visible" boolean DEFAULT true,
	"custom_sort_order" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "profile_navigation_items_pkey" PRIMARY KEY("profile_id","navigation_item_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"property_type" text,
	"total_units" integer,
	"photo_urls" text[],
	"notes" text,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"unit_id" uuid,
	"property_id" uuid,
	"buyer_first_name" text NOT NULL,
	"buyer_last_name" text NOT NULL,
	"buyer_email" text,
	"buyer_phone" text,
	"buyer_id_number" text,
	"sale_price" numeric(12, 2) NOT NULL,
	"commission_rate" numeric(5, 2) DEFAULT '0',
	"commission_amount" numeric(12, 2) DEFAULT '0',
	"deposit_amount" numeric(12, 2) DEFAULT '0',
	"sale_date" date NOT NULL,
	"closing_date" date,
	"status" text DEFAULT 'pending',
	"payment_method_id" uuid,
	"notes" text,
	"documents" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"billing_period" text DEFAULT 'monthly' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'XOF',
	"status" text DEFAULT 'active',
	"start_date" date NOT NULL,
	"end_date" date,
	"current_period_start" date NOT NULL,
	"current_period_end" date NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false,
	"canceled_at" timestamp with time zone,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"payment_method_id" text,
	"trial_start" date,
	"trial_end" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" uuid,
	CONSTRAINT "super_admins_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "task_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"created_by" uuid,
	"assigned_to" uuid,
	"assigned_tenant_id" uuid,
	"due_date" timestamp with time zone,
	"priority" text DEFAULT 'medium',
	"status" text DEFAULT 'todo',
	"attachments" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"unit_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"email" text,
	"id_number" text,
	"has_extranet_access" boolean DEFAULT false,
	"extranet_token" uuid DEFAULT gen_random_uuid(),
	"language" text DEFAULT 'fr',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"property_id" uuid,
	"unit_number" text NOT NULL,
	"unit_type" text,
	"floor" text,
	"surface" integer,
	"rent_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"charges_amount" numeric(12, 2) DEFAULT '0',
	"deposit_amount" numeric(12, 2) DEFAULT '0',
	"sale_price" numeric(12, 2) DEFAULT '0',
	"photo_urls" text[],
	"status" text DEFAULT 'vacant',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"role" text DEFAULT 'viewer',
	"profile_id" uuid,
	"token" text NOT NULL,
	"invitation_method" text DEFAULT 'email',
	"invited_by" uuid,
	"status" text DEFAULT 'pending',
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"sb_user_id" text,
	"email" text,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"role" text DEFAULT 'viewer',
	"avatar_url" text,
	"is_active" boolean DEFAULT true,
	"is_super_admin" boolean DEFAULT false,
	"profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_sb_user_id_unique" UNIQUE("sb_user_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buttons" ADD CONSTRAINT "buttons_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_parent_key_navigation_items_key_fk" FOREIGN KEY ("parent_key") REFERENCES "public"."navigation_items"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_definitions" ADD CONSTRAINT "object_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_navigation_items" ADD CONSTRAINT "organization_navigation_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_navigation_items" ADD CONSTRAINT "organization_navigation_items_navigation_item_key_navigation_items_key_fk" FOREIGN KEY ("navigation_item_key") REFERENCES "public"."navigation_items"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_country_countries_code_fk" FOREIGN KEY ("country") REFERENCES "public"."countries"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_transfers" ADD CONSTRAINT "owner_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_transfers" ADD CONSTRAINT "owner_transfers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_transfers" ADD CONSTRAINT "owner_transfers_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_transfers" ADD CONSTRAINT "owner_transfers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_transfers" ADD CONSTRAINT "owner_transfers_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_buttons" ADD CONSTRAINT "profile_buttons_button_id_buttons_id_fk" FOREIGN KEY ("button_id") REFERENCES "public"."buttons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_navigation_items" ADD CONSTRAINT "profile_navigation_items_navigation_item_id_navigation_items_id_fk" FOREIGN KEY ("navigation_item_id") REFERENCES "public"."navigation_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_tenant_id_tenants_id_fk" FOREIGN KEY ("assigned_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activities_org" ON "activities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_activities_entity" ON "activities" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_activities_user" ON "activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activities_created" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_activities_action" ON "activities" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_activities_org_entity" ON "activities" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_activities_org_created" ON "activities" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_buttons_key" ON "buttons" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_buttons_object_type" ON "buttons" USING btree ("object_type");--> statement-breakpoint
CREATE INDEX "idx_buttons_action" ON "buttons" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_buttons_active" ON "buttons" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_buttons_feature_id" ON "buttons" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "idx_buttons_object_action" ON "buttons" USING btree ("object_type","action");--> statement-breakpoint
CREATE INDEX "idx_countries_currency" ON "countries" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "idx_countries_is_active" ON "countries" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_features_name" ON "features" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_features_category" ON "features" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_journal_org" ON "journal_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_lease_dates" ON "leases" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_messages_tenant" ON "messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_navigation_items_key" ON "navigation_items" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_navigation_items_parent" ON "navigation_items" USING btree ("parent_key");--> statement-breakpoint
CREATE INDEX "idx_navigation_items_active" ON "navigation_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_navigation_items_feature_id" ON "navigation_items" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "idx_navigation_items_sort" ON "navigation_items" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_read_at" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_org" ON "notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_object_definitions_key" ON "object_definitions" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "idx_object_definitions_active" ON "object_definitions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_object_definitions_category" ON "object_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_org_nav_org" ON "organization_navigation_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_nav_item" ON "organization_navigation_items" USING btree ("navigation_item_key");--> statement-breakpoint
CREATE INDEX "idx_org_nav_enabled" ON "organization_navigation_items" USING btree ("organization_id","is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_org_nav_item" ON "organization_navigation_items" USING btree ("organization_id","navigation_item_key");--> statement-breakpoint
CREATE INDEX "idx_organizations_country" ON "organizations" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_owner_transfers_org" ON "owner_transfers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_owner_transfers_owner" ON "owner_transfers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_owner_transfers_status" ON "owner_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_owner_transfers_due_date" ON "owner_transfers" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_owners_org" ON "owners" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_owners_property" ON "owners" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_org_slug" ON "payment_methods" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_payments_org" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_plan_features_plan" ON "plan_features" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_plan_features_feature" ON "plan_features" USING btree ("feature_name");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_plan_feature" ON "plan_features" USING btree ("plan_id","feature_name");--> statement-breakpoint
CREATE INDEX "idx_plans_name" ON "plans" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_profile_buttons_profile" ON "profile_buttons" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_profile_buttons_button" ON "profile_buttons" USING btree ("button_id");--> statement-breakpoint
CREATE INDEX "idx_profile_buttons_enabled" ON "profile_buttons" USING btree ("profile_id","is_enabled");--> statement-breakpoint
CREATE INDEX "idx_profile_nav_profile" ON "profile_navigation_items" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_profile_nav_item" ON "profile_navigation_items" USING btree ("navigation_item_id");--> statement-breakpoint
CREATE INDEX "idx_profile_nav_enabled" ON "profile_navigation_items" USING btree ("profile_id","is_enabled");--> statement-breakpoint
CREATE INDEX "idx_sales_org" ON "sales" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_sales_unit" ON "sales" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_sales_status" ON "sales" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sub_org" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_sub_status" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_super_admins_user" ON "super_admins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_task_activities_task" ON "task_activities" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_activities_user" ON "task_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_task_activities_created" ON "task_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_org" ON "tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_created_by" ON "tasks" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_tasks_assigned_to" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_tenants_org" ON "tenants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_unit_types_org" ON "unit_types" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_types_org_slug_unique" ON "unit_types" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_units_org" ON "units" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_org" ON "user_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_token" ON "user_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_invitations_email" ON "user_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_invitations_phone" ON "user_invitations" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_invitations_status" ON "user_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invitations_profile" ON "user_invitations" USING btree ("profile_id");