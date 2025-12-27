-- =================================================================
-- Drop plan_role_permissions table
-- =================================================================
-- This table is no longer needed as permissions are now managed through:
-- - Profiles (profiles + profile_permissions) for user permissions
-- - Plan Features (plan_features) for plan-based feature access
--
-- The plan_role_permissions table was redundant and has been replaced
-- by the profile-based permission system.

BEGIN;

-- Remove from Supabase Realtime publication if it exists
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS plan_role_permissions;

-- Drop indexes
DROP INDEX IF EXISTS idx_plan_role_permissions_plan;
DROP INDEX IF EXISTS idx_plan_role_permissions_plan_id;
DROP INDEX IF EXISTS idx_plan_role_permissions_role;
DROP INDEX IF EXISTS idx_plan_role_permissions_composite;

-- Drop constraints
ALTER TABLE plan_role_permissions
DROP CONSTRAINT IF EXISTS plan_role_permissions_plan_name_fkey;

ALTER TABLE plan_role_permissions
DROP CONSTRAINT IF EXISTS fk_plan_role_permissions_plan_id;

ALTER TABLE plan_role_permissions
DROP CONSTRAINT IF EXISTS plan_role_permissions_plan_name_role_key;

ALTER TABLE plan_role_permissions
DROP CONSTRAINT IF EXISTS plan_role_permissions_plan_id_role_key;

-- Drop the table
DROP TABLE IF EXISTS plan_role_permissions;

COMMIT;

-- Note: This migration removes the legacy plan_role_permissions table.
-- Permissions are now managed through:
-- 1. Profiles (profiles table + profile_permissions table) - for user-level permissions
-- 2. Plan Features (plan_features table) - for plan-based feature availability

