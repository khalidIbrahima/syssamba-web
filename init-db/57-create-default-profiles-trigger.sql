-- =====================================================
-- Trigger to Create Default Profiles for New Organizations
-- 
-- NOTE: THIS TRIGGER IS DISABLED
-- We now use existing global system profiles (is_global = TRUE) instead of
-- creating organization-specific profiles. See init-db/61-disable-organization-profiles-trigger.sql
--
-- This file is kept for reference but the trigger should be disabled.
-- Global profiles are shared across all organizations:
--   - System Administrator (for new signups)
--   - Propriétaire (Owner)
--   - Administrateur (Admin)
--   - Comptable (Accountant)
--   - Agent
--   - Lecteur (Viewer)
-- =====================================================

-- 1. Create configuration table for default profiles
CREATE TABLE IF NOT EXISTS default_profiles_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    is_system_profile BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(name)
);

-- 2. Insert default profiles configuration (if not exists)
DO $$
DECLARE
    v_has_display_name BOOLEAN;
    v_has_permissions BOOLEAN;
BEGIN
    -- Check if display_name and permissions columns exist in profiles table
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'display_name'
    ) INTO v_has_display_name;
    
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'permissions'
    ) INTO v_has_permissions;

    -- Insert default profiles configuration
    -- Note: System Administrator is a global profile, not created per organization
    INSERT INTO default_profiles_config (name, display_name, description, is_system_profile, is_active)
    VALUES 
        ('Owner', 'Propriétaire', 'Profil propriétaire avec accès complet à ses biens', TRUE, TRUE),
        ('Accountant', 'Comptable', 'Profil comptable avec accès aux données financières et comptables', TRUE, TRUE),
        ('Agent', 'Agent', 'Profil agent avec accès opérationnel pour la gestion des biens et locataires', TRUE, TRUE),
        ('Viewer', 'Lecteur', 'Profil lecteur avec accès en lecture seule', TRUE, TRUE)
    ON CONFLICT (name) DO NOTHING;
    
    RAISE NOTICE 'Default profiles configuration loaded';
END $$;

-- 3. Function to create default profiles for an organization
CREATE OR REPLACE FUNCTION create_default_profiles_for_organization(
    p_organization_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_profile_config RECORD;
    v_profile_id UUID;
    v_has_display_name BOOLEAN;
    v_has_permissions BOOLEAN;
BEGIN
    -- Check if display_name and permissions columns exist
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'display_name'
    ) INTO v_has_display_name;
    
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'permissions'
    ) INTO v_has_permissions;

    -- Loop through all default profile configurations
    FOR v_profile_config IN 
        SELECT * FROM default_profiles_config WHERE is_active = TRUE
        ORDER BY name
    LOOP
        -- Check if profile already exists for this organization
        SELECT id INTO v_profile_id
        FROM profiles
        WHERE organization_id = p_organization_id
          AND name = v_profile_config.name
        LIMIT 1;
        
        -- If profile doesn't exist, create it
        IF v_profile_id IS NULL THEN
            IF v_has_display_name AND v_has_permissions THEN
                INSERT INTO profiles (
                    organization_id,
                    name,
                    display_name,
                    description,
                    is_system_profile,
                    is_global,
                    is_active,
                    permissions,
                    created_at,
                    updated_at
                ) VALUES (
                    p_organization_id,
                    v_profile_config.name,
                    COALESCE(v_profile_config.display_name, v_profile_config.name),
                    v_profile_config.description,
                    v_profile_config.is_system_profile,
                    FALSE, -- Organization-specific, not global
                    v_profile_config.is_active,
                    '{}'::jsonb,
                    NOW(),
                    NOW()
                ) RETURNING id INTO v_profile_id;
            ELSIF v_has_display_name THEN
                INSERT INTO profiles (
                    organization_id,
                    name,
                    display_name,
                    description,
                    is_system_profile,
                    is_global,
                    is_active,
                    created_at,
                    updated_at
                ) VALUES (
                    p_organization_id,
                    v_profile_config.name,
                    COALESCE(v_profile_config.display_name, v_profile_config.name),
                    v_profile_config.description,
                    v_profile_config.is_system_profile,
                    FALSE, -- Organization-specific, not global
                    v_profile_config.is_active,
                    NOW(),
                    NOW()
                ) RETURNING id INTO v_profile_id;
            ELSE
                INSERT INTO profiles (
                    organization_id,
                    name,
                    description,
                    is_system_profile,
                    is_global,
                    is_active,
                    created_at,
                    updated_at
                ) VALUES (
                    p_organization_id,
                    v_profile_config.name,
                    v_profile_config.description,
                    v_profile_config.is_system_profile,
                    FALSE, -- Organization-specific, not global
                    v_profile_config.is_active,
                    NOW(),
                    NOW()
                ) RETURNING id INTO v_profile_id;
            END IF;
            
            RAISE NOTICE 'Created profile "%" for organization %', v_profile_config.name, p_organization_id;
        ELSE
            RAISE NOTICE 'Profile "%" already exists for organization %', v_profile_config.name, p_organization_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Finished creating default profiles for organization %', p_organization_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger function
CREATE OR REPLACE FUNCTION trigger_create_default_profiles()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the function to create default profiles
    PERFORM create_default_profiles_for_organization(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger on organizations table
DROP TRIGGER IF EXISTS trg_create_default_profiles ON organizations;
CREATE TRIGGER trg_create_default_profiles
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_default_profiles();

-- 6. Comments
COMMENT ON TABLE default_profiles_config IS 'Configuration table for default profiles that are created for each new organization';
COMMENT ON FUNCTION create_default_profiles_for_organization IS 'Creates default profiles for a given organization based on the configuration table';
COMMENT ON FUNCTION trigger_create_default_profiles IS 'Trigger function that creates default profiles when a new organization is created';

-- 7. Grant permissions (adjust as needed for your security model)
-- GRANT SELECT, INSERT, UPDATE ON default_profiles_config TO authenticated;
-- GRANT EXECUTE ON FUNCTION create_default_profiles_for_organization TO authenticated;

-- 8. Display completion message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Default Profiles Trigger Created';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'The trigger will automatically create default profiles when a new organization is created.';
    RAISE NOTICE 'To modify default profiles, update the default_profiles_config table.';
    RAISE NOTICE '';
    RAISE NOTICE 'To manually create default profiles for an existing organization:';
    RAISE NOTICE '  SELECT create_default_profiles_for_organization(''<organization-id>'');';
    RAISE NOTICE '';
END $$;

