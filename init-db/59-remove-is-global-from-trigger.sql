-- =====================================================
-- Migration: Remove is_global from create_default_profiles_for_organization function
-- This updates the trigger function to remove references to the is_global column
-- =====================================================

-- Update the function to remove is_global column references
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
                    is_active,
                    created_at,
                    updated_at
                ) VALUES (
                    p_organization_id,
                    v_profile_config.name,
                    COALESCE(v_profile_config.display_name, v_profile_config.name),
                    v_profile_config.description,
                    v_profile_config.is_system_profile,
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
                    is_active,
                    created_at,
                    updated_at
                ) VALUES (
                    p_organization_id,
                    v_profile_config.name,
                    v_profile_config.description,
                    v_profile_config.is_system_profile,
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

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Trigger function updated - is_global removed';
    RAISE NOTICE '========================================';
END $$;

