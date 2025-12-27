-- =====================================================
-- Add sb_user_id column to users table
-- This column explicitly links Supabase auth.users.id to users table
-- =====================================================

-- Add sb_user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'sb_user_id'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN sb_user_id UUID UNIQUE;
        
        RAISE NOTICE '✓ Colonne sb_user_id ajoutée à la table users';
    ELSE
        RAISE NOTICE '✓ Colonne sb_user_id existe déjà';
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_sb_user_id ON users(sb_user_id) 
WHERE sb_user_id IS NOT NULL;

-- Migrate existing data: if id matches a Supabase user pattern (UUID), copy to sb_user_id
-- For existing users where id is already a Supabase UUID, set sb_user_id = id
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Update users where id is a valid UUID (likely Supabase users)
    -- and sb_user_id is NULL
    UPDATE users
    SET sb_user_id = id
    WHERE sb_user_id IS NULL
      AND id IS NOT NULL
      AND id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '✓ % utilisateur(s) mis à jour avec sb_user_id = id', v_count;
END $$;

-- Add comment
COMMENT ON COLUMN users.sb_user_id IS 'ID de l''utilisateur dans Supabase Auth (auth.users.id). Utilisé pour lier explicitement l''utilisateur Supabase à l''enregistrement dans users.';

-- Verify the migration
SELECT 
    'Total users' AS description,
    COUNT(*) AS count
FROM users
UNION ALL
SELECT 
    'Users with sb_user_id' AS description,
    COUNT(*) AS count
FROM users
WHERE sb_user_id IS NOT NULL
UNION ALL
SELECT 
    'Users without sb_user_id' AS description,
    COUNT(*) AS count
FROM users
WHERE sb_user_id IS NULL;

