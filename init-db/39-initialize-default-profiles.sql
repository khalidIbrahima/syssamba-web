-- =====================================================
-- Initialize Default System Profiles
-- Creates global system profiles shared by all organizations
-- =====================================================

-- Create global system profiles (shared across all organizations)
-- These profiles are based on the standard roles: owner, admin, accountant, agent, viewer

-- Create Owner Profile (Global)
INSERT INTO profiles (organization_id, name, description, is_system_profile, is_global, is_active)
VALUES (NULL, 'Propriétaire', 'Profil propriétaire avec accès complet', TRUE, TRUE, TRUE)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Create Admin Profile (Global)
INSERT INTO profiles (organization_id, name, description, is_system_profile, is_global, is_active)
VALUES (NULL, 'Administrateur', 'Profil administrateur avec accès étendu', TRUE, TRUE, TRUE)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Create Accountant Profile (Global)
INSERT INTO profiles (organization_id, name, description, is_system_profile, is_global, is_active)
VALUES (NULL, 'Comptable', 'Profil comptable avec accès aux données financières', TRUE, TRUE, TRUE)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Create Agent Profile (Global)
INSERT INTO profiles (organization_id, name, description, is_system_profile, is_global, is_active)
VALUES (NULL, 'Agent', 'Profil agent avec accès opérationnel', TRUE, TRUE, TRUE)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Create Viewer Profile (Global)
INSERT INTO profiles (organization_id, name, description, is_system_profile, is_global, is_active)
VALUES (NULL, 'Lecteur', 'Profil lecteur avec accès en lecture seule', TRUE, TRUE, TRUE)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Assign global system profiles to existing users based on their role
DO $$
DECLARE
    user_record RECORD;
    v_profile_id UUID;
BEGIN
    FOR user_record IN 
        SELECT u.id, u.organization_id, u.role 
        FROM users u 
        WHERE u.profile_id IS NULL
    LOOP
        -- Find the corresponding global system profile
        SELECT p.id INTO v_profile_id
        FROM profiles p
        WHERE p.is_global = TRUE
          AND p.organization_id IS NULL
          AND (
            (user_record.role = 'owner' AND p.name = 'Propriétaire') OR
            (user_record.role = 'admin' AND p.name = 'Administrateur') OR
            (user_record.role = 'accountant' AND p.name = 'Comptable') OR
            (user_record.role = 'agent' AND p.name = 'Agent') OR
            (user_record.role = 'viewer' AND p.name = 'Lecteur')
          )
        LIMIT 1;
        
        -- Assign profile to user
        IF v_profile_id IS NOT NULL THEN
            UPDATE users 
            SET profile_id = v_profile_id 
            WHERE users.id = user_record.id;
        END IF;
    END LOOP;
END $$;

-- Set default profile for new users (based on role)
-- This will be handled by application logic, but we can set a default
-- For now, we'll ensure all existing users have a profile

COMMENT ON FUNCTION get_user_profile_permissions IS 'Get all object-level permissions for a user based on their profile';
COMMENT ON FUNCTION get_user_profile_field_permissions IS 'Get field-level permissions for a user based on their profile and object type';

