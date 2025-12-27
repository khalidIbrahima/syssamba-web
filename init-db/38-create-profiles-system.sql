-- =====================================================
-- Salesforce-Inspired Profiles System
-- Each user has a profile that defines their base permissions
-- =====================================================

-- 1. PROFILES TABLE
-- Stores profile definitions (like Salesforce Profiles)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for global system profiles
    name TEXT NOT NULL,
    description TEXT,
    is_system_profile BOOLEAN DEFAULT FALSE, -- System profiles (owner, admin, etc.) cannot be deleted
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

-- Add is_global column if it doesn't exist (for existing installations)
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
    END IF;
END $$;

-- Add constraint for global profiles (if it doesn't exist)
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

-- 2. PROFILE OBJECT PERMISSIONS
-- Links profiles to object-level permissions
CREATE TABLE IF NOT EXISTS profile_object_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL,
    access_level TEXT CHECK (access_level IN ('None', 'Read', 'ReadWrite', 'All')) NOT NULL,
    can_create BOOLEAN DEFAULT FALSE,
    can_read BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_view_all BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(profile_id, object_type)
);

-- 3. PROFILE FIELD PERMISSIONS
-- Links profiles to field-level permissions
CREATE TABLE IF NOT EXISTS profile_field_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    access_level TEXT CHECK (access_level IN ('None', 'Read', 'ReadWrite')) NOT NULL,
    can_read BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    is_sensitive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(profile_id, object_type, field_name)
);

-- 4. ADD PROFILE_ID TO USERS TABLE
-- Each user must have a profile
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profile_object_permissions_profile ON profile_object_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_field_permissions_profile ON profile_field_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_users_profile ON users(profile_id);

-- Add to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE profile_object_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE profile_field_permissions;

-- Helper function to get user's effective permissions from profile
CREATE OR REPLACE FUNCTION get_user_profile_permissions(
    p_user_id UUID
)
RETURNS TABLE (
    object_type TEXT,
    can_create BOOLEAN,
    can_read BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_view_all BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pop.object_type,
        pop.can_create,
        pop.can_read,
        pop.can_edit,
        pop.can_delete,
        pop.can_view_all
    FROM users u
    JOIN profile_object_permissions pop ON u.profile_id = pop.profile_id
    WHERE u.id = p_user_id
      AND u.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's field permissions from profile
CREATE OR REPLACE FUNCTION get_user_profile_field_permissions(
    p_user_id UUID,
    p_object_type TEXT
)
RETURNS TABLE (
    field_name TEXT,
    can_read BOOLEAN,
    can_edit BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pfp.field_name,
        pfp.can_read,
        pfp.can_edit
    FROM users u
    JOIN profile_field_permissions pfp ON u.profile_id = pfp.profile_id
    WHERE u.id = p_user_id
      AND u.is_active = TRUE
      AND pfp.object_type = p_object_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE profiles IS 'Profiles: Base permission sets for users (like Salesforce Profiles)';
COMMENT ON TABLE profile_object_permissions IS 'Profile Object Permissions: Object-level permissions for each profile';
COMMENT ON TABLE profile_field_permissions IS 'Profile Field Permissions: Field-level permissions for each profile';
COMMENT ON COLUMN users.profile_id IS 'Profile assigned to the user - defines base permissions';
COMMENT ON FUNCTION get_user_profile_permissions IS 'Get all object-level permissions for a user based on their profile';
COMMENT ON FUNCTION get_user_profile_field_permissions IS 'Get field-level permissions for a user based on their profile and object type';

