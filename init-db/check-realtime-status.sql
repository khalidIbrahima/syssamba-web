-- =====================================================
-- Check Supabase Realtime Status
-- Run this in your Supabase SQL editor to verify Realtime is enabled
-- =====================================================

-- 1. Check which tables are in the Realtime publication
SELECT 
    schemaname,
    tablename,
    '✓ Enabled' as realtime_status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 2. Check if tasks table is enabled
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'tasks'
        ) THEN '✓ Tasks table is enabled for Realtime'
        ELSE '✗ Tasks table is NOT enabled for Realtime'
    END as tasks_realtime_status;

-- 3. Check RLS status (should be disabled for Clerk)
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '⚠️  RLS ENABLED (may block Realtime)'
        ELSE '✓ RLS DISABLED (OK for Clerk)'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tasks', 'messages', 'payments')
ORDER BY tablename;

-- 4. Summary
DO $$
DECLARE
    tasks_enabled BOOLEAN;
    messages_enabled BOOLEAN;
    payments_enabled BOOLEAN;
BEGIN
    -- Check tasks
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'tasks'
    ) INTO tasks_enabled;
    
    -- Check messages
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'messages'
    ) INTO messages_enabled;
    
    -- Check payments
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'payments'
    ) INTO payments_enabled;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Supabase Realtime Status Check';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tasks:   %', CASE WHEN tasks_enabled THEN '✓ ENABLED' ELSE '✗ DISABLED' END;
    RAISE NOTICE 'Messages: %', CASE WHEN messages_enabled THEN '✓ ENABLED' ELSE '✗ DISABLED' END;
    RAISE NOTICE 'Payments: %', CASE WHEN payments_enabled THEN '✓ ENABLED' ELSE '✗ DISABLED' END;
    RAISE NOTICE '';
    
    IF NOT tasks_enabled THEN
        RAISE NOTICE '⚠️  To enable Realtime for tasks, run:';
        RAISE NOTICE '   ALTER PUBLICATION supabase_realtime ADD TABLE tasks;';
    END IF;
    
    IF NOT messages_enabled THEN
        RAISE NOTICE '⚠️  To enable Realtime for messages, run:';
        RAISE NOTICE '   ALTER PUBLICATION supabase_realtime ADD TABLE messages;';
    END IF;
    
    IF NOT payments_enabled THEN
        RAISE NOTICE '⚠️  To enable Realtime for payments, run:';
        RAISE NOTICE '   ALTER PUBLICATION supabase_realtime ADD TABLE payments;';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Or run the full setup script:';
    RAISE NOTICE '   init-db/23-enable-supabase-realtime-clerk.sql';
    RAISE NOTICE '';
END $$;

