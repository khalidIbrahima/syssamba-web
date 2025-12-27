-- =====================================================
-- Migration: Add is_global column to profiles table
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
        -- This assumes system profiles are those with is_system_profile = TRUE
        UPDATE profiles 
        SET is_global = TRUE 
        WHERE is_system_profile = TRUE 
          AND organization_id IS NULL;
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

