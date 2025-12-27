-- 43-verify-and-fix-plan-features-profiles.sql
-- Verify and fix coherence between plan features and profile permissions

DO $$
DECLARE
    v_plan_name TEXT;
    v_feature_key TEXT;
    v_profile_id UUID;
    v_org_id UUID;
    v_profile_name TEXT;
    v_object_type TEXT;
    v_missing_features TEXT[];
    v_missing_profiles TEXT[];
    v_plan_record RECORD;
    v_org_record RECORD;
    v_has_plan_id BOOLEAN;
    v_has_plan_name BOOLEAN;
    v_profile_record RECORD;
    v_updated_count INTEGER;
    v_has_plan_id BOOLEAN;
    v_default_profiles TEXT[] := ARRAY['Propriétaire', 'Administrateur', 'Comptable', 'Agent', 'Lecteur'];
    v_object_types TEXT[] := ARRAY[
        'Property', 'Unit', 'Tenant', 'Lease', 'Payment', 
        'Task', 'Message', 'JournalEntry', 'User', 
        'Organization', 'Report', 'Activity'
    ];
    v_core_features TEXT[] := ARRAY[
        'dashboard', 'properties_management', 'units_management'
    ];
    v_required_features TEXT[] := ARRAY[
        'dashboard', 'properties_management', 'units_management', 
        'tenants_basic', 'leases_basic', 'payments_manual_entry',
        'basic_tasks', 'messaging'
    ];
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Starting Plan Features & Profiles Verification';
    RAISE NOTICE '========================================';
    
    -- ============================================================
    -- 1. Ensure messaging feature exists and is enabled for all plans
    -- ============================================================
    RAISE NOTICE '';
    RAISE NOTICE '1. Checking messaging feature...';
    
    -- Ensure messaging feature exists
    INSERT INTO features (key, name, description, category, icon) VALUES
    ('messaging', 'Messagerie', 'Système de messagerie entre utilisateurs et locataires', 'notifications', 'MessageSquare')
    ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        icon = EXCLUDED.icon,
        updated_at = NOW();
    
    -- Enable messaging for all plans
    -- Check if plan_id column exists (after migration) or use plan_name (before migration)
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plan_features' 
        AND column_name = 'plan_id'
    ) INTO v_has_plan_id;
    
    -- Check if plan_name column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plan_features' 
        AND column_name = 'plan_name'
    ) INTO v_has_plan_name;
    
    IF v_has_plan_id AND v_has_plan_name THEN
        -- Both columns exist (during migration) - populate both
        FOR v_plan_record IN SELECT id, name FROM plans
        LOOP
            INSERT INTO plan_features (plan_id, plan_name, feature_key, is_enabled)
            VALUES (v_plan_record.id, v_plan_record.name, 'messaging', TRUE)
            ON CONFLICT (plan_id, feature_key) DO UPDATE SET
                is_enabled = TRUE,
                updated_at = NOW();
            
            RAISE NOTICE '  ✓ Messaging enabled for plan: %', v_plan_record.name;
        END LOOP;
    ELSIF v_has_plan_id THEN
        -- Only plan_id exists (after migration complete)
        FOR v_plan_record IN SELECT id, name FROM plans
        LOOP
            INSERT INTO plan_features (plan_id, feature_key, is_enabled)
            VALUES (v_plan_record.id, 'messaging', TRUE)
            ON CONFLICT (plan_id, feature_key) DO UPDATE SET
                is_enabled = TRUE,
                updated_at = NOW();
            
            RAISE NOTICE '  ✓ Messaging enabled for plan: %', v_plan_record.name;
        END LOOP;
    ELSE
        -- Only plan_name exists (before migration)
        FOR v_plan_record IN SELECT name FROM plans
        LOOP
            INSERT INTO plan_features (plan_name, feature_key, is_enabled)
            VALUES (v_plan_record.name, 'messaging', TRUE)
            ON CONFLICT (plan_name, feature_key) DO UPDATE SET
                is_enabled = TRUE,
                updated_at = NOW();
            
            RAISE NOTICE '  ✓ Messaging enabled for plan: %', v_plan_record.name;
        END LOOP;
    END IF;
    
    -- ============================================================
    -- 2. Ensure all required features are enabled for each plan
    -- ============================================================
    RAISE NOTICE '';
    RAISE NOTICE '2. Verifying required features for each plan...';
    
    IF v_has_plan_id AND v_has_plan_name THEN
        -- Both columns exist (during migration) - populate both
        FOR v_plan_record IN SELECT id, name FROM plans
        LOOP
            v_missing_features := ARRAY[]::TEXT[];
            
            -- Check each required feature
            FOREACH v_feature_key IN ARRAY v_required_features
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM plan_features
                    WHERE plan_id = v_plan_record.id
                      AND feature_key = v_feature_key
                      AND is_enabled = TRUE
                ) THEN
                    -- Feature missing, add it
                    INSERT INTO plan_features (plan_id, plan_name, feature_key, is_enabled)
                    VALUES (v_plan_record.id, v_plan_record.name, v_feature_key, TRUE)
                    ON CONFLICT (plan_id, feature_key) DO UPDATE SET
                        is_enabled = TRUE,
                        updated_at = NOW();
                    
                    v_missing_features := array_append(v_missing_features, v_feature_key);
                    RAISE NOTICE '  ✓ Added missing feature % to plan %', v_feature_key, v_plan_record.name;
                END IF;
            END LOOP;
            
            IF array_length(v_missing_features, 1) IS NULL THEN
                RAISE NOTICE '  ✓ Plan % has all required features', v_plan_record.name;
            END IF;
        END LOOP;
    ELSIF v_has_plan_id THEN
        -- Only plan_id exists (after migration complete)
        FOR v_plan_record IN SELECT id, name FROM plans
        LOOP
            v_missing_features := ARRAY[]::TEXT[];
            
            -- Check each required feature
            FOREACH v_feature_key IN ARRAY v_required_features
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM plan_features
                    WHERE plan_id = v_plan_record.id
                      AND feature_key = v_feature_key
                      AND is_enabled = TRUE
                ) THEN
                    -- Feature missing, add it
                    INSERT INTO plan_features (plan_id, feature_key, is_enabled)
                    VALUES (v_plan_record.id, v_feature_key, TRUE)
                    ON CONFLICT (plan_id, feature_key) DO UPDATE SET
                        is_enabled = TRUE,
                        updated_at = NOW();
                    
                    v_missing_features := array_append(v_missing_features, v_feature_key);
                    RAISE NOTICE '  ✓ Added missing feature % to plan %', v_feature_key, v_plan_record.name;
                END IF;
            END LOOP;
            
            IF array_length(v_missing_features, 1) IS NULL THEN
                RAISE NOTICE '  ✓ Plan % has all required features', v_plan_record.name;
            END IF;
        END LOOP;
    ELSE
        -- Use plan_name (before migration)
        FOR v_plan_record IN SELECT name FROM plans
        LOOP
            v_missing_features := ARRAY[]::TEXT[];
            
            -- Check each required feature
            FOREACH v_feature_key IN ARRAY v_required_features
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM plan_features
                    WHERE plan_name = v_plan_record.name
                      AND feature_key = v_feature_key
                      AND is_enabled = TRUE
                ) THEN
                    -- Feature missing, add it
                    INSERT INTO plan_features (plan_name, feature_key, is_enabled)
                    VALUES (v_plan_record.name, v_feature_key, TRUE)
                    ON CONFLICT (plan_name, feature_key) DO UPDATE SET
                        is_enabled = TRUE,
                        updated_at = NOW();
                    
                    v_missing_features := array_append(v_missing_features, v_feature_key);
                    RAISE NOTICE '  ✓ Added missing feature % to plan %', v_feature_key, v_plan_record.name;
                END IF;
            END LOOP;
            
            IF array_length(v_missing_features, 1) IS NULL THEN
                RAISE NOTICE '  ✓ Plan % has all required features', v_plan_record.name;
            END IF;
        END LOOP;
    END IF;
    
    -- ============================================================
    -- 3. Ensure default profiles exist for all organizations
    -- ============================================================
    RAISE NOTICE '';
    RAISE NOTICE '3. Verifying default profiles for each organization...';
    
    FOR v_org_record IN SELECT id, name FROM organizations
    LOOP
        v_missing_profiles := ARRAY[]::TEXT[];
        
        -- Check each default profile
        FOREACH v_profile_name IN ARRAY v_default_profiles
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM profiles
                WHERE organization_id = v_org_record.id
                  AND name = v_profile_name
            ) THEN
                -- Profile missing, create it
                INSERT INTO profiles (
                    organization_id, name, description, 
                    is_system_profile, is_global, is_active
                ) VALUES (
                    v_org_record.id,
                    v_profile_name,
                    CASE v_profile_name
                        WHEN 'Propriétaire' THEN 'Profil propriétaire avec accès complet'
                        WHEN 'Administrateur' THEN 'Profil administrateur avec accès étendu'
                        WHEN 'Comptable' THEN 'Profil comptable avec accès aux données financières'
                        WHEN 'Agent' THEN 'Profil agent avec accès opérationnel'
                        WHEN 'Lecteur' THEN 'Profil lecteur avec accès en lecture seule'
                    END,
                    TRUE,  -- is_system_profile
                    FALSE, -- is_global (organization-specific)
                    TRUE   -- is_active
                ) RETURNING id INTO v_profile_id;
                
                v_missing_profiles := array_append(v_missing_profiles, v_profile_name);
                RAISE NOTICE '  ✓ Created missing profile % for organization %', v_profile_name, v_org_record.name;
                
                -- Set basic permissions based on profile type
                IF v_profile_name = 'Propriétaire' OR v_profile_name = 'Administrateur' THEN
                    -- Full access for Owner and Admin
                    FOREACH v_object_type IN ARRAY v_object_types
                    LOOP
                        INSERT INTO profile_object_permissions (
                            profile_id, object_type, access_level,
                            can_create, can_read, can_edit, can_delete, can_view_all
                        ) VALUES (
                            v_profile_id, v_object_type, 'All',
                            TRUE, TRUE, TRUE, TRUE, TRUE
                        ) ON CONFLICT (profile_id, object_type) DO UPDATE SET
                            access_level = 'All',
                            can_create = TRUE,
                            can_read = TRUE,
                            can_edit = TRUE,
                            can_delete = TRUE,
                            can_view_all = TRUE,
                            updated_at = NOW();
                    END LOOP;
                ELSIF v_profile_name = 'Comptable' THEN
                    -- Accountant: Read access to financial data, limited write
                    FOREACH v_object_type IN ARRAY v_object_types
                    LOOP
                        INSERT INTO profile_object_permissions (
                            profile_id, object_type, access_level,
                            can_create, can_read, can_edit, can_delete, can_view_all
                        ) VALUES (
                            v_profile_id, v_object_type,
                            CASE 
                                WHEN v_object_type IN ('Payment', 'JournalEntry', 'Lease') THEN 'ReadWrite'
                                WHEN v_object_type = 'Organization' THEN 'Read'
                                ELSE 'Read'
                            END,
                            CASE WHEN v_object_type IN ('Payment', 'JournalEntry') THEN TRUE ELSE FALSE END,
                            TRUE,  -- can_read
                            CASE WHEN v_object_type IN ('Payment', 'JournalEntry') THEN TRUE ELSE FALSE END,
                            FALSE, -- can_delete
                            FALSE  -- can_view_all
                        ) ON CONFLICT (profile_id, object_type) DO UPDATE SET
                            updated_at = NOW();
                    END LOOP;
                ELSIF v_profile_name = 'Agent' THEN
                    -- Agent: Read/Write access to operational data
                    FOREACH v_object_type IN ARRAY v_object_types
                    LOOP
                        INSERT INTO profile_object_permissions (
                            profile_id, object_type, access_level,
                            can_create, can_read, can_edit, can_delete, can_view_all
                        ) VALUES (
                            v_profile_id, v_object_type,
                            CASE 
                                WHEN v_object_type IN ('Property', 'Unit', 'Tenant', 'Lease', 'Task', 'Message') THEN 'ReadWrite'
                                WHEN v_object_type = 'Payment' THEN 'Read'
                                ELSE 'Read'
                            END,
                            CASE WHEN v_object_type IN ('Property', 'Unit', 'Tenant', 'Lease', 'Task', 'Message') THEN TRUE ELSE FALSE END,
                            TRUE,  -- can_read
                            CASE WHEN v_object_type IN ('Property', 'Unit', 'Tenant', 'Lease', 'Task', 'Message') THEN TRUE ELSE FALSE END,
                            FALSE, -- can_delete
                            FALSE  -- can_view_all
                        ) ON CONFLICT (profile_id, object_type) DO UPDATE SET
                            updated_at = NOW();
                    END LOOP;
                ELSE -- Viewer
                    -- Viewer: Read-only access
                    FOREACH v_object_type IN ARRAY v_object_types
                    LOOP
                        INSERT INTO profile_object_permissions (
                            profile_id, object_type, access_level,
                            can_create, can_read, can_edit, can_delete, can_view_all
                        ) VALUES (
                            v_profile_id, v_object_type, 'Read',
                            FALSE, FALSE, FALSE, FALSE, FALSE
                        ) ON CONFLICT (profile_id, object_type) DO UPDATE SET
                            updated_at = NOW();
                    END LOOP;
                END IF;
            END IF;
        END LOOP;
        
        IF array_length(v_missing_profiles, 1) IS NULL THEN
            RAISE NOTICE '  ✓ Organization % has all default profiles', v_org_record.name;
        END IF;
    END LOOP;
    
    -- ============================================================
    -- 4. Ensure users without profiles get assigned to default profile
    -- ============================================================
    RAISE NOTICE '';
    RAISE NOTICE '4. Assigning profiles to users without profiles...';
    
    FOR v_org_record IN SELECT id FROM organizations
    LOOP
        -- Get default profiles for this organization
        DECLARE
            v_owner_profile_id UUID;
            v_admin_profile_id UUID;
            v_accountant_profile_id UUID;
            v_agent_profile_id UUID;
            v_viewer_profile_id UUID;
        BEGIN
            SELECT id INTO v_owner_profile_id
            FROM profiles
            WHERE organization_id = v_org_record.id AND name = 'Propriétaire';
            
            SELECT id INTO v_admin_profile_id
            FROM profiles
            WHERE organization_id = v_org_record.id AND name = 'Administrateur';
            
            SELECT id INTO v_accountant_profile_id
            FROM profiles
            WHERE organization_id = v_org_record.id AND name = 'Comptable';
            
            SELECT id INTO v_agent_profile_id
            FROM profiles
            WHERE organization_id = v_org_record.id AND name = 'Agent';
            
            SELECT id INTO v_viewer_profile_id
            FROM profiles
            WHERE organization_id = v_org_record.id AND name = 'Lecteur';
            
            -- Assign profiles based on user role (legacy mapping)
            UPDATE users
            SET profile_id = CASE
                WHEN role = 'owner' AND v_owner_profile_id IS NOT NULL THEN v_owner_profile_id
                WHEN role = 'admin' AND v_admin_profile_id IS NOT NULL THEN v_admin_profile_id
                WHEN role = 'accountant' AND v_accountant_profile_id IS NOT NULL THEN v_accountant_profile_id
                WHEN role = 'agent' AND v_agent_profile_id IS NOT NULL THEN v_agent_profile_id
                ELSE v_viewer_profile_id
            END
            WHERE organization_id = v_org_record.id
              AND profile_id IS NULL
              AND (v_owner_profile_id IS NOT NULL OR v_admin_profile_id IS NOT NULL 
                   OR v_accountant_profile_id IS NOT NULL OR v_agent_profile_id IS NOT NULL 
                   OR v_viewer_profile_id IS NOT NULL);
            
            GET DIAGNOSTICS v_updated_count = ROW_COUNT;
            IF v_updated_count > 0 THEN
                RAISE NOTICE '  ✓ Assigned profiles to % users in organization %', v_updated_count, v_org_record.id;
            END IF;
        END;
    END LOOP;
    
    -- ============================================================
    -- 5. Summary Report
    -- ============================================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verification Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Messaging feature: Enabled for all plans';
    RAISE NOTICE '  - Required features: Verified for all plans';
    RAISE NOTICE '  - Default profiles: Created for all organizations';
    RAISE NOTICE '  - User profiles: Assigned based on roles';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  - Review profile permissions in /settings/profiles';
    RAISE NOTICE '  - Verify plan features in /settings/subscription';
    RAISE NOTICE '';
    
END $$;

