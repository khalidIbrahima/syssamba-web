-- =====================================================
-- Migration: Add is_global column to profiles table
-- This adds the is_global column if it doesn't exist
-- =====================================================

-- Add is_global column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'is_global'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN is_global BOOLEAN DEFAULT FALSE;
        
        -- Update existing system profiles to be global
        -- Global profiles are those with organization_id IS NULL
        UPDATE profiles 
        SET is_global = TRUE 
        WHERE organization_id IS NULL;
        
        -- Organization-specific profiles should have is_global = FALSE
        UPDATE profiles 
        SET is_global = FALSE 
        WHERE organization_id IS NOT NULL;
    END IF;
END $$;

-- Add constraint to ensure global profiles have NULL organization_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'global_profile_check'
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE profiles
        ADD CONSTRAINT global_profile_check CHECK (
            (is_global = TRUE AND organization_id IS NULL) OR 
            (is_global = FALSE AND organization_id IS NOT NULL)
        );
    END IF;
END $$;

COMMENT ON COLUMN profiles.is_global IS 'True for global system profiles shared across all organizations';

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'is_global column added to profiles table';
    RAISE NOTICE '========================================';
END $$;

