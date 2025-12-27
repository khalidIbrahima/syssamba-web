-- =====================================================
-- 06-update-organizations.sql
-- Migration: Add country field, remove plan/planId and limit fields from organizations
-- These fields are now in subscriptions and plans tables
-- =====================================================

-- Add country column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'country'
    ) THEN
        ALTER TABLE organizations 
        ADD COLUMN country TEXT NOT NULL DEFAULT 'SN';
        
        -- Update existing organizations to have default country
        UPDATE organizations 
        SET country = 'SN' 
        WHERE country IS NULL;
        
        RAISE NOTICE 'Column country added to organizations table';
    ELSE
        RAISE NOTICE 'Column country already exists in organizations table';
    END IF;
END $$;

-- Remove plan column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'plan'
    ) THEN
        DROP INDEX IF EXISTS idx_organizations_plan;
        ALTER TABLE organizations DROP COLUMN IF EXISTS plan;
        RAISE NOTICE 'Column plan removed from organizations table';
    ELSE
        RAISE NOTICE 'Column plan does not exist in organizations table';
    END IF;
END $$;

-- Remove plan_id column if it exists (plan is now in subscriptions table)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'plan_id'
    ) THEN
        -- Drop foreign key constraint first
        ALTER TABLE organizations 
        DROP CONSTRAINT IF EXISTS organizations_plan_id_plans_id_fk;
        
        -- Drop the plan_id column
        ALTER TABLE organizations 
        DROP COLUMN IF EXISTS plan_id;
        
        RAISE NOTICE 'Column plan_id removed from organizations table';
    ELSE
        RAISE NOTICE 'Column plan_id does not exist in organizations table';
    END IF;
END $$;

-- Remove limit columns (they are in plans table and can be retrieved via subscriptions)
DO $$
BEGIN
    -- Remove lots_limit
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'lots_limit'
    ) THEN
        ALTER TABLE organizations DROP COLUMN IF EXISTS lots_limit;
        RAISE NOTICE 'Column lots_limit removed from organizations table';
    END IF;
    
    -- Remove users_limit
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'users_limit'
    ) THEN
        ALTER TABLE organizations DROP COLUMN IF EXISTS users_limit;
        RAISE NOTICE 'Column users_limit removed from organizations table';
    END IF;
    
    -- Remove extranet_tenants_limit
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'extranet_tenants_limit'
    ) THEN
        ALTER TABLE organizations DROP COLUMN IF EXISTS extranet_tenants_limit;
        RAISE NOTICE 'Column extranet_tenants_limit removed from organizations table';
    END IF;
END $$;

-- Verify the changes
DO $$
BEGIN
    RAISE NOTICE 'Verifying changes...';
    
    -- Check if country exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'country'
    ) THEN
        RAISE NOTICE '✓ Country column exists';
    ELSE
        RAISE WARNING '✗ Country column does not exist';
    END IF;
    
    -- Check if plan was removed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'plan'
    ) THEN
        RAISE NOTICE '✓ Plan column removed';
    ELSE
        RAISE WARNING '✗ Plan column still exists';
    END IF;
    
    -- Check if plan_id was removed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'plan_id'
    ) THEN
        RAISE NOTICE '✓ Plan_id column removed';
    ELSE
        RAISE WARNING '✗ Plan_id column still exists';
    END IF;
    
    -- Check if limit columns were removed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'lots_limit'
    ) THEN
        RAISE NOTICE '✓ Lots_limit column removed';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'users_limit'
    ) THEN
        RAISE NOTICE '✓ Users_limit column removed';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'extranet_tenants_limit'
    ) THEN
        RAISE NOTICE '✓ Extranet_tenants_limit column removed';
    END IF;
END $$;

