-- =================================================================
-- SAMBA ONE - Migration: Add profile_id to user_invitations
-- Adds profile_id column to user_invitations table
-- =================================================================

-- Step 1: Add profile_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_invitations' AND column_name = 'profile_id'
    ) THEN
        ALTER TABLE user_invitations ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_invitations_profile ON user_invitations(profile_id) WHERE profile_id IS NOT NULL;
    END IF;
END $$;

-- Step 2: Add comment to document the column
COMMENT ON COLUMN user_invitations.profile_id IS 'Profile assigned to the invited user. References profiles(id).';

