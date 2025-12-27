-- =====================================================
-- Create Missing Profiles
-- This script creates all necessary profiles if they don't exist
-- =====================================================

DO $$
DECLARE
    v_profile_id UUID;
    v_has_display_name BOOLEAN;
    v_has_permissions BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Creating Missing Profiles';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
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
    
    -- ============================================================
    -- 1. SYSTEM ADMINISTRATOR (Global)
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE name = 'System Administrator'
      AND organization_id IS NULL
      AND is_system_profile = TRUE
    LIMIT 1;
    
    IF v_profile_id IS NULL THEN
        RAISE NOTICE 'Creating System Administrator profile...';
        
        IF v_has_display_name AND v_has_permissions THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                permissions,
                created_at,
                updated_at
            ) VALUES (
                'System Administrator',
                'System Administrator',
                'Global system administrator profile with full access to all features and data',
                NULL,
                TRUE,
                TRUE,
                '{}'::jsonb,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSIF v_has_display_name THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'System Administrator',
                'System Administrator',
                'Global system administrator profile with full access to all features and data',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSE
            INSERT INTO profiles (
                name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'System Administrator',
                'Global system administrator profile with full access to all features and data',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        END IF;
        
        RAISE NOTICE '  ✓ Created System Administrator profile: %', v_profile_id;
    ELSE
        RAISE NOTICE '  ✓ System Administrator profile already exists: %', v_profile_id;
    END IF;
    
    -- ============================================================
    -- 2. ORGANIZATION ADMINISTRATOR (Global)
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE name = 'Organization Administrator'
      AND organization_id IS NULL
      AND is_system_profile = TRUE
    LIMIT 1;
    
    IF v_profile_id IS NULL THEN
        RAISE NOTICE 'Creating Organization Administrator profile...';
        
        IF v_has_display_name AND v_has_permissions THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                permissions,
                created_at,
                updated_at
            ) VALUES (
                'Organization Administrator',
                'Organization Administrator',
                'Organization administrator profile with full access to organization features',
                NULL,
                TRUE,
                TRUE,
                '{}'::jsonb,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSIF v_has_display_name THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Organization Administrator',
                'Organization Administrator',
                'Organization administrator profile with full access to organization features',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSE
            INSERT INTO profiles (
                name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Organization Administrator',
                'Organization administrator profile with full access to organization features',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        END IF;
        
        RAISE NOTICE '  ✓ Created Organization Administrator profile: %', v_profile_id;
    ELSE
        RAISE NOTICE '  ✓ Organization Administrator profile already exists: %', v_profile_id;
    END IF;
    
    -- ============================================================
    -- 3. OWNER / PROPRIÉTAIRE (Global)
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE (name = 'Owner' OR name = 'Propriétaire')
      AND organization_id IS NULL
      AND is_system_profile = TRUE
    LIMIT 1;
    
    IF v_profile_id IS NULL THEN
        RAISE NOTICE 'Creating Owner/Propriétaire profile...';
        
        IF v_has_display_name AND v_has_permissions THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                permissions,
                created_at,
                updated_at
            ) VALUES (
                'Propriétaire',
                'Propriétaire',
                'Profil propriétaire avec accès complet',
                NULL,
                TRUE,
                TRUE,
                '{}'::jsonb,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSIF v_has_display_name THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Propriétaire',
                'Propriétaire',
                'Profil propriétaire avec accès complet',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSE
            INSERT INTO profiles (
                name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Propriétaire',
                'Profil propriétaire avec accès complet',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        END IF;
        
        RAISE NOTICE '  ✓ Created Owner/Propriétaire profile: %', v_profile_id;
    ELSE
        RAISE NOTICE '  ✓ Owner/Propriétaire profile already exists: %', v_profile_id;
    END IF;
    
    -- ============================================================
    -- 4. ADMIN / ADMINISTRATEUR (Global)
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE (name = 'Admin' OR name = 'Administrateur')
      AND organization_id IS NULL
      AND is_system_profile = TRUE
    LIMIT 1;
    
    IF v_profile_id IS NULL THEN
        RAISE NOTICE 'Creating Admin/Administrateur profile...';
        
        IF v_has_display_name AND v_has_permissions THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                permissions,
                created_at,
                updated_at
            ) VALUES (
                'Administrateur',
                'Administrateur',
                'Profil administrateur avec accès étendu',
                NULL,
                TRUE,
                TRUE,
                '{}'::jsonb,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSIF v_has_display_name THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Administrateur',
                'Administrateur',
                'Profil administrateur avec accès étendu',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSE
            INSERT INTO profiles (
                name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Administrateur',
                'Profil administrateur avec accès étendu',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        END IF;
        
        RAISE NOTICE '  ✓ Created Admin/Administrateur profile: %', v_profile_id;
    ELSE
        RAISE NOTICE '  ✓ Admin/Administrateur profile already exists: %', v_profile_id;
    END IF;
    
    -- ============================================================
    -- 5. ACCOUNTANT / COMPTABLE (Global)
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE (name = 'Accountant' OR name = 'Comptable')
      AND organization_id IS NULL
      AND is_system_profile = TRUE
    LIMIT 1;
    
    IF v_profile_id IS NULL THEN
        RAISE NOTICE 'Creating Accountant/Comptable profile...';
        
        IF v_has_display_name AND v_has_permissions THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                permissions,
                created_at,
                updated_at
            ) VALUES (
                'Comptable',
                'Comptable',
                'Profil comptable avec accès aux données financières',
                NULL,
                TRUE,
                TRUE,
                '{}'::jsonb,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSIF v_has_display_name THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Comptable',
                'Comptable',
                'Profil comptable avec accès aux données financières',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSE
            INSERT INTO profiles (
                name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Comptable',
                'Profil comptable avec accès aux données financières',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        END IF;
        
        RAISE NOTICE '  ✓ Created Accountant/Comptable profile: %', v_profile_id;
    ELSE
        RAISE NOTICE '  ✓ Accountant/Comptable profile already exists: %', v_profile_id;
    END IF;
    
    -- ============================================================
    -- 6. AGENT (Global)
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE name = 'Agent'
      AND organization_id IS NULL
      AND is_system_profile = TRUE
    LIMIT 1;
    
    IF v_profile_id IS NULL THEN
        RAISE NOTICE 'Creating Agent profile...';
        
        IF v_has_display_name AND v_has_permissions THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                permissions,
                created_at,
                updated_at
            ) VALUES (
                'Agent',
                'Agent',
                'Profil agent avec accès opérationnel',
                NULL,
                TRUE,
                TRUE,
                '{}'::jsonb,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSIF v_has_display_name THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Agent',
                'Agent',
                'Profil agent avec accès opérationnel',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSE
            INSERT INTO profiles (
                name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Agent',
                'Profil agent avec accès opérationnel',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        END IF;
        
        RAISE NOTICE '  ✓ Created Agent profile: %', v_profile_id;
    ELSE
        RAISE NOTICE '  ✓ Agent profile already exists: %', v_profile_id;
    END IF;
    
    -- ============================================================
    -- 7. VIEWER / LECTEUR (Global)
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE (name = 'Viewer' OR name = 'Lecteur')
      AND organization_id IS NULL
      AND is_system_profile = TRUE
    LIMIT 1;
    
    IF v_profile_id IS NULL THEN
        RAISE NOTICE 'Creating Viewer/Lecteur profile...';
        
        IF v_has_display_name AND v_has_permissions THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                permissions,
                created_at,
                updated_at
            ) VALUES (
                'Lecteur',
                'Lecteur',
                'Profil lecteur avec accès en lecture seule',
                NULL,
                TRUE,
                TRUE,
                '{}'::jsonb,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSIF v_has_display_name THEN
            INSERT INTO profiles (
                name,
                display_name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Lecteur',
                'Lecteur',
                'Profil lecteur avec accès en lecture seule',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        ELSE
            INSERT INTO profiles (
                name,
                description,
                organization_id,
                is_system_profile,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'Lecteur',
                'Profil lecteur avec accès en lecture seule',
                NULL,
                TRUE,
                TRUE,
                NOW(),
                NOW()
            ) RETURNING id INTO v_profile_id;
        END IF;
        
        RAISE NOTICE '  ✓ Created Viewer/Lecteur profile: %', v_profile_id;
    ELSE
        RAISE NOTICE '  ✓ Viewer/Lecteur profile already exists: %', v_profile_id;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Successfully created/verified all profiles';
    RAISE NOTICE '========================================';
END $$;

