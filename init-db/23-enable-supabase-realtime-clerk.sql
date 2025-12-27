-- =====================================================
-- 23-enable-supabase-realtime-clerk.sql
-- Enable Supabase Realtime for Clerk-based authentication
-- Run this in your Supabase SQL editor
-- =====================================================

-- =====================================================
-- 1. Enable Realtime Replication
-- =====================================================

-- Enable replication for messages table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
        RAISE NOTICE '✓ Realtime enabled for messages table';
    ELSE
        RAISE NOTICE '⚠️  Realtime already enabled for messages table';
    END IF;
END $$;

-- Enable replication for tasks table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
        RAISE NOTICE '✓ Realtime enabled for tasks table';
    ELSE
        RAISE NOTICE '⚠️  Realtime already enabled for tasks table';
    END IF;
END $$;

-- Enable replication for payments table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'payments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE payments;
        RAISE NOTICE '✓ Realtime enabled for payments table';
    ELSE
        RAISE NOTICE '⚠️  Realtime already enabled for payments table';
    END IF;
END $$;

-- =====================================================
-- 2. Row Level Security (RLS) - Option A: Disabled for Development
-- =====================================================

-- Uncomment these lines to DISABLE RLS (for development/testing)
-- ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. Row Level Security (RLS) - Option B: Enabled with Service Role
-- =====================================================

-- If you want to use RLS with Clerk, you'll need to:
-- 1. Use service role key on the server side
-- 2. Or create custom JWT with organization_id
-- 3. Or filter client-side (current implementation)

-- Enable RLS (uncomment to enable)
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Example policy for tasks (requires custom JWT with organization_id)
-- CREATE POLICY "tasks_org_policy" ON tasks
-- FOR ALL USING (
--   organization_id::text = current_setting('request.jwt.claims', true)::json->>'organization_id'
-- );

-- =====================================================
-- 4. Verification
-- =====================================================

-- Check which tables are in the Realtime publication
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Check RLS status
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tasks', 'messages', 'payments')
ORDER BY tablename;

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
    RAISE NOTICE '⚠️  Note: Using Clerk authentication';
    RAISE NOTICE '   RLS is currently disabled for development.';
    RAISE NOTICE '   Filtering is done client-side by organization_id.';
    RAISE NOTICE '   For production, configure RLS with custom JWT.';
    RAISE NOTICE '';
END $$;

