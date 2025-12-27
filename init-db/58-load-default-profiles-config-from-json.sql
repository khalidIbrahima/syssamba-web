-- =====================================================
-- Load Default Profiles Configuration from JSON File
-- This script reads the default-profiles.json file and loads it into the database
-- =====================================================
-- 
-- NOTE: This is a helper script. In production, you would typically:
-- 1. Use the default_profiles_config table directly
-- 2. Or use a migration tool that can read JSON files
-- 3. Or use PostgreSQL's COPY command with a CSV/JSON file
--
-- For now, we'll use a DO block to insert the configuration
-- =====================================================

DO $$
DECLARE
    v_config_json JSONB;
    v_profile_config JSONB;
BEGIN
    -- This is the JSON configuration from default-profiles.json
    -- In a real scenario, you might read this from a file using PostgreSQL extensions
    -- or use a migration tool that supports JSON file reading
    
    v_config_json := '{
        "defaultProfiles": [
            {
                "name": "Owner",
                "displayName": "Propriétaire",
                "description": "Profil propriétaire avec accès complet à ses biens",
                "isSystemProfile": true,
                "isActive": true
            },
            {
                "name": "Accountant",
                "displayName": "Comptable",
                "description": "Profil comptable avec accès aux données financières et comptables",
                "isSystemProfile": true,
                "isActive": true
            },
            {
                "name": "Agent",
                "displayName": "Agent",
                "description": "Profil agent avec accès opérationnel pour la gestion des biens et locataires",
                "isSystemProfile": true,
                "isActive": true
            },
            {
                "name": "Viewer",
                "displayName": "Lecteur",
                "description": "Profil lecteur avec accès en lecture seule",
                "isSystemProfile": true,
                "isActive": true
            }
        ]
    }'::jsonb;
    
    -- Clear existing configuration (optional - comment out if you want to keep existing)
    -- DELETE FROM default_profiles_config;
    
    -- Insert each profile from the JSON configuration
    FOR v_profile_config IN 
        SELECT * FROM jsonb_array_elements(v_config_json->'defaultProfiles')
    LOOP
        INSERT INTO default_profiles_config (
            name,
            display_name,
            description,
            is_system_profile,
            is_active
        ) VALUES (
            v_profile_config->>'name',
            COALESCE(v_profile_config->>'displayName', v_profile_config->>'name'),
            v_profile_config->>'description',
            COALESCE((v_profile_config->>'isSystemProfile')::boolean, TRUE),
            COALESCE((v_profile_config->>'isActive')::boolean, TRUE)
        )
        ON CONFLICT (name) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            is_system_profile = EXCLUDED.is_system_profile,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();
    END LOOP;
    
    RAISE NOTICE 'Loaded % default profiles from JSON configuration', 
        jsonb_array_length(v_config_json->'defaultProfiles');
END $$;

-- Verify the configuration was loaded
SELECT 
    name,
    display_name,
    description,
    is_system_profile,
    is_active
FROM default_profiles_config
ORDER BY name;

