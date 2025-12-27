-- Fix super admin column
-- Adds the is_super_admin column to users table if it doesn't exist

-- Add is_super_admin column to users table if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Add comment to the column
COMMENT ON COLUMN users.is_super_admin IS 'Flag indiquant si l''utilisateur est un super-admin';

-- Create helper function
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check in is_super_admin column
    IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND is_super_admin = TRUE) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create view for easy querying
CREATE OR REPLACE VIEW super_admin_users AS
SELECT
    u.id,
    u.sb_user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.organization_id,
    u.is_super_admin,
    u.created_at AS super_admin_since
FROM users u
WHERE u.is_super_admin = TRUE;

COMMENT ON VIEW super_admin_users IS 'Vue listant tous les super-admins';
