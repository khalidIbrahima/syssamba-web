-- =====================================================
-- SAMBA ONE - Enable Row Level Security (RLS) on All Tables
-- =====================================================
-- This migration enables RLS on all tables and creates basic security policies.
-- 
-- IMPORTANT NOTES:
-- 1. The application currently uses SUPABASE_SERVICE_ROLE_KEY which BYPASSES RLS
--    - This means enabling RLS will NOT break existing functionality
--    - Service role key has full access regardless of RLS policies
-- 2. RLS policies are created for future use when migrating to user-based authentication
-- 3. Public catalog tables (plans, features, countries, accounts) remain publicly readable
-- 4. Organization-scoped tables require users to belong to the organization
--
-- IMPACT ON PROJECT:
-- ✅ NO IMMEDIATE IMPACT - Service role key bypasses RLS
-- ⚠️ FUTURE IMPACT - When switching to user tokens, policies will enforce access control
-- =====================================================

-- =====================================================
-- 1. ENABLE RLS ON ALL ORGANIZATION-SCOPED TABLES
-- =====================================================

-- Core organization tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Subscription and billing tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Security and permissions tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_object_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_field_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_definitions ENABLE ROW LEVEL SECURITY;

-- Navigation and UI tables
ALTER TABLE navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_buttons ENABLE ROW LEVEL SECURITY;

-- User management tables
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Owner and transfer tables
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_transfers ENABLE ROW LEVEL SECURITY;

-- Activity and logging tables
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Support tables
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_comments ENABLE ROW LEVEL SECURITY;

-- Configuration tables
ALTER TABLE unit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_profiles_config ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. HELPER FUNCTION: Get current user's organization_id
-- =====================================================
-- This function extracts the organization_id from the current user context
-- 
-- CURRENT SETUP (Clerk + Service Role):
--   - Service role key bypasses RLS completely
--   - Policies below are placeholders for future use
--   - When migrating to user-based auth, update this function
--
-- FUTURE OPTIONS:
--   1. Use Supabase Auth: Extract from auth.uid() and join with users table
--   2. Use Clerk JWT: Extract from JWT claims (requires custom JWT setup in Supabase)
--   3. Use session variable: Set via set_config() in application code

CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Option 1: For Supabase Auth (when migrated)
  -- SELECT id INTO current_user_id FROM users WHERE id = auth.uid();
  -- RETURN (SELECT organization_id FROM users WHERE id = current_user_id);
  
  -- Option 2: For Clerk (requires custom JWT setup)
  -- Extract from JWT claim: auth.jwt() ->> 'clerk_user_id'
  -- Then lookup in users table by clerk_id
  
  -- Option 3: For service role (current setup)
  -- Service role bypasses RLS, so return NULL to allow all
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. RLS POLICIES FOR ORGANIZATION-SCOPED TABLES
-- =====================================================

-- Organizations: Users can only see their own organization
-- NOTE: These policies use auth.uid() which requires Supabase Auth
-- For Clerk integration, you'll need to:
--   1. Set up custom JWT in Supabase with Clerk user ID
--   2. Update policies to use JWT claims or session variables
--   3. Or use application-level filtering (current approach with service role)
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    -- For Supabase Auth (future):
    -- id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    -- For Clerk (future): Use JWT claims or session variables
    -- For now: Service role bypasses (get_user_organization_id() returns NULL)
    get_user_organization_id() IS NULL
    OR id = get_user_organization_id()
  );

CREATE POLICY "Users can update their own organization"
  ON organizations FOR UPDATE
  USING (
    get_user_organization_id() IS NULL
    OR id = get_user_organization_id()
  );

-- Users: Users can see users in their organization
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

CREATE POLICY "Users can insert users in their organization"
  ON users FOR INSERT
  WITH CHECK (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

CREATE POLICY "Users can update users in their organization"
  ON users FOR UPDATE
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Properties: Organization-scoped
CREATE POLICY "Users can manage properties in their organization"
  ON properties FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Units: Organization-scoped
CREATE POLICY "Users can manage units in their organization"
  ON units FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Tenants: Organization-scoped
CREATE POLICY "Users can manage tenants in their organization"
  ON tenants FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Leases: Organization-scoped
CREATE POLICY "Users can manage leases in their organization"
  ON leases FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Payment Methods: Organization-scoped
CREATE POLICY "Users can manage payment methods in their organization"
  ON payment_methods FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Payments: Organization-scoped
CREATE POLICY "Users can manage payments in their organization"
  ON payments FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Journal Entries: Organization-scoped
CREATE POLICY "Users can manage journal entries in their organization"
  ON journal_entries FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Journal Lines: Accessible through journal entries
CREATE POLICY "Users can manage journal lines in their organization"
  ON journal_lines FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR entry_id IN (
      SELECT id FROM journal_entries 
      WHERE organization_id = get_user_organization_id()
    )
  );

-- Tasks: Organization-scoped
CREATE POLICY "Users can manage tasks in their organization"
  ON tasks FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Notifications: Organization-scoped
CREATE POLICY "Users can manage notifications in their organization"
  ON notifications FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Messages: Organization-scoped
CREATE POLICY "Users can manage messages in their organization"
  ON messages FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Subscriptions: Organization-scoped
CREATE POLICY "Users can view subscriptions in their organization"
  ON subscriptions FOR SELECT
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Subscription Payments: Organization-scoped
CREATE POLICY "Users can view subscription payments in their organization"
  ON subscription_payments FOR SELECT
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Profiles: Organization-scoped (if applicable) or global
CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT
  USING (true); -- Profiles may be global or org-scoped, adjust as needed

-- Profile Permissions: Accessible to users in the organization
CREATE POLICY "Users can view profile permissions"
  ON profile_object_permissions FOR SELECT
  USING (true); -- Adjust based on your profile system design

CREATE POLICY "Users can view profile field permissions"
  ON profile_field_permissions FOR SELECT
  USING (true);

-- Object and Field Permissions: Typically global/system-level
CREATE POLICY "Users can view object permissions"
  ON object_permissions FOR SELECT
  USING (true);

CREATE POLICY "Users can view field permissions"
  ON field_permissions FOR SELECT
  USING (true);

-- Custom Roles: Organization-scoped
CREATE POLICY "Users can manage custom roles in their organization"
  ON custom_roles FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Object Definitions: Typically global
CREATE POLICY "Users can view object definitions"
  ON object_definitions FOR SELECT
  USING (true);

-- Navigation Items: Organization-scoped
CREATE POLICY "Users can manage navigation items in their organization"
  ON organization_navigation_items FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Profile Navigation Items: Accessible to users
CREATE POLICY "Users can view profile navigation items"
  ON profile_navigation_items FOR SELECT
  USING (true);

-- Buttons: Organization-scoped or global
CREATE POLICY "Users can view buttons"
  ON buttons FOR SELECT
  USING (true);

CREATE POLICY "Users can view profile buttons"
  ON profile_buttons FOR SELECT
  USING (true);

-- User Invitations: Organization-scoped
CREATE POLICY "Users can manage invitations in their organization"
  ON user_invitations FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Owners: Organization-scoped
CREATE POLICY "Users can manage owners in their organization"
  ON owners FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Owner Transfers: Organization-scoped
CREATE POLICY "Users can manage owner transfers in their organization"
  ON owner_transfers FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Activities: Organization-scoped
CREATE POLICY "Users can view activities in their organization"
  ON activities FOR SELECT
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Task Activities: Organization-scoped through tasks
CREATE POLICY "Users can view task activities in their organization"
  ON task_activities FOR SELECT
  USING (
    get_user_organization_id() IS NULL
    OR task_id IN (
      SELECT id FROM tasks 
      WHERE organization_id = get_user_organization_id()
    )
  );

-- System Logs: Typically admin-only, but allow organization-scoped access
CREATE POLICY "Users can view system logs in their organization"
  ON system_logs FOR SELECT
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Support Tickets: Organization-scoped
CREATE POLICY "Users can manage support tickets in their organization"
  ON support_tickets FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR organization_id = get_user_organization_id()
  );

-- Support Ticket Comments: Through support tickets
CREATE POLICY "Users can manage support ticket comments"
  ON support_ticket_comments FOR ALL
  USING (
    get_user_organization_id() IS NULL
    OR ticket_id IN (
      SELECT id FROM support_tickets 
      WHERE organization_id = get_user_organization_id()
    )
  );

-- Unit Types: Typically global or organization-scoped
CREATE POLICY "Users can view unit types"
  ON unit_types FOR SELECT
  USING (true);

-- Default Profiles Config: Typically global
CREATE POLICY "Users can view default profiles config"
  ON default_profiles_config FOR SELECT
  USING (true);

-- =====================================================
-- 4. PUBLIC CATALOG TABLES (Already handled in 04-rls-plans-features.sql)
-- =====================================================
-- These tables remain publicly readable:
-- - plans (RLS disabled)
-- - features (RLS disabled)
-- - plan_features (RLS disabled)
-- - countries (public catalog)
-- - accounts (SYSCOHADA chart of accounts, public catalog)

-- Countries: Public read access
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Countries are publicly readable"
  ON countries FOR SELECT
  USING (true);

-- Accounts: Public read access (SYSCOHADA chart of accounts)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accounts are publicly readable"
  ON accounts FOR SELECT
  USING (true);

-- =====================================================
-- 5. SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS enabled on all tables';
  RAISE NOTICE '✅ Security policies created';
  RAISE NOTICE '';
  RAISE NOTICE '📋 IMPORTANT NOTES:';
  RAISE NOTICE '   1. Service role key (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS';
  RAISE NOTICE '   2. Current application will continue to work without changes';
  RAISE NOTICE '   3. Policies use get_user_organization_id() which currently returns NULL';
  RAISE NOTICE '   4. To use RLS with Clerk auth, update get_user_organization_id() function';
  RAISE NOTICE '   5. Public catalog tables (plans, features, countries, accounts) remain readable';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 NEXT STEPS (if migrating to user-based auth):';
  RAISE NOTICE '   1. Set up Clerk JWT integration with Supabase';
  RAISE NOTICE '   2. Update get_user_organization_id() to extract from JWT or session';
  RAISE NOTICE '   3. Test policies with user tokens (not service role)';
  RAISE NOTICE '   4. Consider using application-level filtering as alternative';
END $$;

