-- =================================================================
-- SAMBA ONE - Migration: Users table to Supabase Auth
-- Migrates users table from clerk_id to sb_user_id for Supabase Auth
-- =================================================================

-- Step 1: Add sb_user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'sb_user_id'
    ) THEN
        ALTER TABLE users ADD COLUMN sb_user_id TEXT UNIQUE;
        CREATE INDEX IF NOT EXISTS idx_users_sb_user_id ON users(sb_user_id) WHERE sb_user_id IS NOT NULL;
    END IF;
END $$;

-- Step 2: Add profile_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'profile_id'
    ) THEN
        ALTER TABLE users ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_users_profile_id ON users(profile_id) WHERE profile_id IS NOT NULL;
    END IF;
END $$;

-- Step 3: Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Step 4: Migrate existing data (if clerk_id exists and matches Supabase auth users)
-- This assumes that existing users might have their Supabase auth ID stored elsewhere
-- or that we need to link them manually. For now, we'll keep clerk_id for backward compatibility
-- but make sb_user_id the primary link going forward.

-- Step 5: Make clerk_id nullable (optional) for backward compatibility
-- Users created via Supabase Auth will have sb_user_id, not clerk_id
DO $$
BEGIN
    -- Check if clerk_id has NOT NULL constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'users' 
        AND ccu.column_name = 'clerk_id'
        AND tc.constraint_type = 'NOT NULL'
    ) THEN
        -- Remove NOT NULL constraint (if possible)
        -- Note: This might fail if there are NULL values, so we handle it gracefully
        BEGIN
            ALTER TABLE users ALTER COLUMN clerk_id DROP NOT NULL;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not remove NOT NULL constraint from clerk_id: %', SQLERRM;
        END;
    END IF;
END $$;

-- Step 6: Create trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Step 7: Add comment to document the migration
COMMENT ON COLUMN users.sb_user_id IS 'Supabase Auth user ID. Primary link to Supabase authentication.';
COMMENT ON COLUMN users.clerk_id IS 'Legacy Clerk user ID. Kept for backward compatibility. Can be NULL for new Supabase Auth users.';

