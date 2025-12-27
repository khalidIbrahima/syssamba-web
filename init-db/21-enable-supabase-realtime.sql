-- =====================================================
-- 21-enable-supabase-realtime.sql
-- Enable Supabase Realtime replication for tables
-- Run this in your Supabase SQL editor
-- =====================================================

-- Enable replication for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable replication for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Enable replication for payments table
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- Optional: Enable replication for other tables that need real-time
-- ALTER PUBLICATION supabase_realtime ADD TABLE properties;
-- ALTER PUBLICATION supabase_realtime ADD TABLE units;
-- ALTER PUBLICATION supabase_realtime ADD TABLE tenants;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
-- 
-- ⚠️  IMPORTANT: This script assumes Supabase Auth.
-- If you're using Clerk (like SAMBA ONE), you should:
-- 1. Disable RLS (recommended for development)
-- 2. Or configure custom JWT with organization_id
-- 3. Or use service role key on server side
--
-- For Clerk, it's recommended to DISABLE RLS and filter
-- client-side by organization_id (which is already done in hooks).
-- =====================================================

-- Option A: DISABLE RLS (Recommended for Clerk/Development)
-- Uncomment these lines to disable RLS:
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- Option B: ENABLE RLS with Supabase Auth (if using Supabase Auth)
-- Uncomment these lines if you're using Supabase Auth:
/*
-- Enable RLS on tasks table
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tasks from their organization
-- Note: auth.uid() returns UUID, so we compare UUID with UUID
CREATE POLICY "Users can view tasks from their organization"
  ON tasks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE clerk_id = auth.uid()::text
    )
  );

-- Policy: Users can view tasks assigned to them
CREATE POLICY "Users can view assigned tasks"
  ON tasks FOR SELECT
  USING (
    assigned_to IN (
      SELECT id
      FROM users 
      WHERE clerk_id = auth.uid()::text
    )
  );

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages from their organization
CREATE POLICY "Users can view messages from their organization"
  ON messages FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE clerk_id = auth.uid()::text
    )
  );

-- Policy: Tenants can view their own messages
CREATE POLICY "Tenants can view their messages"
  ON messages FOR SELECT
  USING (
    tenant_id IN (
      SELECT id
      FROM tenants 
      WHERE extranet_token = auth.uid()::text
    )
  );

-- Enable RLS on payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view payments from their organization
CREATE POLICY "Users can view payments from their organization"
  ON payments FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE clerk_id = auth.uid()::text
    )
  );
*/

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Supabase Realtime Configuration Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Realtime enabled for:';
    RAISE NOTICE '  - messages';
    RAISE NOTICE '  - tasks';
    RAISE NOTICE '  - payments';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS Status:';
    RAISE NOTICE '  - RLS is DISABLED (recommended for Clerk)';
    RAISE NOTICE '  - Filtering is done client-side by organization_id';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Note: Using Clerk authentication';
    RAISE NOTICE '   RLS is disabled. For production with Clerk,';
    RAISE NOTICE '   configure custom JWT or use service role.';
    RAISE NOTICE '';
END $$;

