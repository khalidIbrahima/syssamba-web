-- =====================================================
-- Clear Profile Permissions Data
-- This script empties all data from profile_object_permissions
-- and profile_field_permissions tables
-- =====================================================

DO $$
BEGIN
    -- Clear profile_field_permissions first (due to foreign key constraints)
    TRUNCATE TABLE profile_field_permissions CASCADE;
    RAISE NOTICE 'Cleared profile_field_permissions table';
    
    -- Clear profile_object_permissions
    TRUNCATE TABLE profile_object_permissions CASCADE;
    RAISE NOTICE 'Cleared profile_object_permissions table';
    
    RAISE NOTICE 'Profile permissions tables have been cleared successfully';
END $$;

-- Verify tables are empty
SELECT 
    'profile_object_permissions' AS table_name,
    COUNT(*) AS row_count
FROM profile_object_permissions
UNION ALL
SELECT 
    'profile_field_permissions' AS table_name,
    COUNT(*) AS row_count
FROM profile_field_permissions;

