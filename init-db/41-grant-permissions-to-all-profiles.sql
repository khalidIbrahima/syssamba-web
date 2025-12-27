-- Grant appropriate permissions to all system profiles
-- This script sets permissions for Owner, Admin, Accountant, Agent, and Viewer profiles

DO $$
DECLARE
    v_profile_id UUID;
    v_object_type TEXT;
    v_field_name TEXT;
    v_object_types TEXT[] := ARRAY[
        'Property',
        'Unit',
        'Tenant',
        'Lease',
        'Payment',
        'Task',
        'Message',
        'JournalEntry',
        'User',
        'Organization',
        'Report',
        'Activity'
    ];
    v_field_permissions RECORD;
BEGIN
    -- ============================================================
    -- 1. OWNER PROFILE (Propriétaire) - Full Access
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE (name = 'Owner' OR name = 'Propriétaire')
      AND is_global = TRUE 
      AND is_system_profile = TRUE
      AND organization_id IS NULL
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
        RAISE NOTICE 'Setting permissions for Owner profile: %', v_profile_id;
        
        -- Grant all object-level permissions
        FOREACH v_object_type IN ARRAY v_object_types
        LOOP
            IF EXISTS (
                SELECT 1 FROM profile_object_permissions
                WHERE profile_id = v_profile_id AND object_type = v_object_type
            ) THEN
                UPDATE profile_object_permissions
                SET 
                    access_level = 'All',
                    can_create = TRUE,
                    can_read = TRUE,
                    can_edit = TRUE,
                    can_delete = TRUE,
                    can_view_all = TRUE,
                    updated_at = NOW()
                WHERE profile_id = v_profile_id AND object_type = v_object_type;
            ELSE
                INSERT INTO profile_object_permissions (
                    profile_id, object_type, access_level,
                    can_create, can_read, can_edit, can_delete, can_view_all,
                    created_at, updated_at
                ) VALUES (
                    v_profile_id, v_object_type, 'All',
                    TRUE, TRUE, TRUE, TRUE, TRUE,
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Owner profile permissions set';
    END IF;

    -- ============================================================
    -- 2. ADMIN PROFILE (Administrateur) - Full Access
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE (name = 'Admin' OR name = 'Administrateur')
      AND is_global = TRUE 
      AND is_system_profile = TRUE
      AND organization_id IS NULL
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
        RAISE NOTICE 'Setting permissions for Admin profile: %', v_profile_id;
        
        -- Grant all object-level permissions (same as Owner)
        FOREACH v_object_type IN ARRAY v_object_types
        LOOP
            IF EXISTS (
                SELECT 1 FROM profile_object_permissions
                WHERE profile_id = v_profile_id AND object_type = v_object_type
            ) THEN
                UPDATE profile_object_permissions
                SET 
                    access_level = 'All',
                    can_create = TRUE,
                    can_read = TRUE,
                    can_edit = TRUE,
                    can_delete = TRUE,
                    can_view_all = TRUE,
                    updated_at = NOW()
                WHERE profile_id = v_profile_id AND object_type = v_object_type;
            ELSE
                INSERT INTO profile_object_permissions (
                    profile_id, object_type, access_level,
                    can_create, can_read, can_edit, can_delete, can_view_all,
                    created_at, updated_at
                ) VALUES (
                    v_profile_id, v_object_type, 'All',
                    TRUE, TRUE, TRUE, TRUE, TRUE,
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Admin profile permissions set';
    END IF;

    -- ============================================================
    -- 3. ACCOUNTANT PROFILE (Comptable) - Financial Data Access
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE (name = 'Accountant' OR name = 'Comptable')
      AND is_global = TRUE 
      AND is_system_profile = TRUE
      AND organization_id IS NULL
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
        RAISE NOTICE 'Setting permissions for Accountant profile: %', v_profile_id;
        
        -- Financial objects: Full access
        FOR v_object_type IN SELECT unnest(ARRAY['Payment', 'JournalEntry', 'Report', 'Activity']) AS obj
        LOOP
            IF EXISTS (
                SELECT 1 FROM profile_object_permissions
                WHERE profile_id = v_profile_id AND object_type = v_object_type
            ) THEN
                UPDATE profile_object_permissions
                SET 
                    access_level = 'All',
                    can_create = TRUE,
                    can_read = TRUE,
                    can_edit = TRUE,
                    can_delete = TRUE,
                    can_view_all = TRUE,
                    updated_at = NOW()
                WHERE profile_id = v_profile_id AND object_type = v_object_type;
            ELSE
                INSERT INTO profile_object_permissions (
                    profile_id, object_type, access_level,
                    can_create, can_read, can_edit, can_delete, can_view_all,
                    created_at, updated_at
                ) VALUES (
                    v_profile_id, v_object_type, 'All',
                    TRUE, TRUE, TRUE, TRUE, TRUE,
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
        
        -- Related objects: Read-only access
        FOR v_object_type IN SELECT unnest(ARRAY['Property', 'Unit', 'Tenant', 'Lease']) AS obj
        LOOP
            IF EXISTS (
                SELECT 1 FROM profile_object_permissions
                WHERE profile_id = v_profile_id AND object_type = v_object_type
            ) THEN
                UPDATE profile_object_permissions
                SET 
                    access_level = 'Read',
                    can_create = FALSE,
                    can_read = TRUE,
                    can_edit = FALSE,
                    can_delete = FALSE,
                    can_view_all = TRUE,
                    updated_at = NOW()
                WHERE profile_id = v_profile_id AND object_type = v_object_type;
            ELSE
                INSERT INTO profile_object_permissions (
                    profile_id, object_type, access_level,
                    can_create, can_read, can_edit, can_delete, can_view_all,
                    created_at, updated_at
                ) VALUES (
                    v_profile_id, v_object_type, 'Read',
                    FALSE, TRUE, FALSE, FALSE, TRUE,
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
        
        -- Limited access to other objects
        FOR v_object_type IN SELECT unnest(ARRAY['Task', 'Message', 'User', 'Organization']) AS obj
        LOOP
            IF EXISTS (
                SELECT 1 FROM profile_object_permissions
                WHERE profile_id = v_profile_id AND object_type = v_object_type
            ) THEN
                UPDATE profile_object_permissions
                SET 
                    access_level = 'Read',
                    can_create = FALSE,
                    can_read = TRUE,
                    can_edit = FALSE,
                    can_delete = FALSE,
                    can_view_all = FALSE,
                    updated_at = NOW()
                WHERE profile_id = v_profile_id AND object_type = v_object_type;
            ELSE
                INSERT INTO profile_object_permissions (
                    profile_id, object_type, access_level,
                    can_create, can_read, can_edit, can_delete, can_view_all,
                    created_at, updated_at
                ) VALUES (
                    v_profile_id, v_object_type, 'Read',
                    FALSE, TRUE, FALSE, FALSE, FALSE,
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Accountant profile permissions set';
    END IF;

    -- ============================================================
    -- 4. AGENT PROFILE (Agent) - Operational Access
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE (name = 'Agent' OR name = 'Agent')
      AND is_global = TRUE 
      AND is_system_profile = TRUE
      AND organization_id IS NULL
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
        RAISE NOTICE 'Setting permissions for Agent profile: %', v_profile_id;
        
        -- Operational objects: Full access (except delete)
        FOR v_object_type IN SELECT unnest(ARRAY['Property', 'Unit', 'Tenant', 'Lease', 'Task', 'Message']) AS obj
        LOOP
            IF EXISTS (
                SELECT 1 FROM profile_object_permissions
                WHERE profile_id = v_profile_id AND object_type = v_object_type
            ) THEN
                UPDATE profile_object_permissions
                SET 
                    access_level = 'ReadWrite',
                    can_create = TRUE,
                    can_read = TRUE,
                    can_edit = TRUE,
                    can_delete = FALSE, -- Agents cannot delete
                    can_view_all = TRUE,
                    updated_at = NOW()
                WHERE profile_id = v_profile_id AND object_type = v_object_type;
            ELSE
                INSERT INTO profile_object_permissions (
                    profile_id, object_type, access_level,
                    can_create, can_read, can_edit, can_delete, can_view_all,
                    created_at, updated_at
                ) VALUES (
                    v_profile_id, v_object_type, 'ReadWrite',
                    TRUE, TRUE, TRUE, FALSE, TRUE,
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
        
        -- Financial objects: Read-only (no access to sensitive financial data)
        FOR v_object_type IN SELECT unnest(ARRAY['Payment', 'JournalEntry']) AS obj
        LOOP
            IF EXISTS (
                SELECT 1 FROM profile_object_permissions
                WHERE profile_id = v_profile_id AND object_type = v_object_type
            ) THEN
                UPDATE profile_object_permissions
                SET 
                    access_level = 'Read',
                    can_create = FALSE,
                    can_read = TRUE,
                    can_edit = FALSE,
                    can_delete = FALSE,
                    can_view_all = TRUE,
                    updated_at = NOW()
                WHERE profile_id = v_profile_id AND object_type = v_object_type;
            ELSE
                INSERT INTO profile_object_permissions (
                    profile_id, object_type, access_level,
                    can_create, can_read, can_edit, can_delete, can_view_all,
                    created_at, updated_at
                ) VALUES (
                    v_profile_id, v_object_type, 'Read',
                    FALSE, TRUE, FALSE, FALSE, TRUE,
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
        
        -- Limited access to other objects
        FOR v_object_type IN SELECT unnest(ARRAY['User', 'Organization', 'Report', 'Activity']) AS obj
        LOOP
            IF EXISTS (
                SELECT 1 FROM profile_object_permissions
                WHERE profile_id = v_profile_id AND object_type = v_object_type
            ) THEN
                UPDATE profile_object_permissions
                SET 
                    access_level = 'Read',
                    can_create = FALSE,
                    can_read = TRUE,
                    can_edit = FALSE,
                    can_delete = FALSE,
                    can_view_all = FALSE,
                    updated_at = NOW()
                WHERE profile_id = v_profile_id AND object_type = v_object_type;
            ELSE
                INSERT INTO profile_object_permissions (
                    profile_id, object_type, access_level,
                    can_create, can_read, can_edit, can_delete, can_view_all,
                    created_at, updated_at
                ) VALUES (
                    v_profile_id, v_object_type, 'Read',
                    FALSE, TRUE, FALSE, FALSE, FALSE,
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Agent profile permissions set';
    END IF;

    -- ============================================================
    -- 5. VIEWER PROFILE (Lecteur) - Read-Only Access
    -- ============================================================
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE (name = 'Viewer' OR name = 'Lecteur')
      AND is_global = TRUE 
      AND is_system_profile = TRUE
      AND organization_id IS NULL
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
        RAISE NOTICE 'Setting permissions for Viewer profile: %', v_profile_id;
        
        -- All objects: Read-only access (no create, edit, delete)
        FOREACH v_object_type IN ARRAY v_object_types
        LOOP
            IF EXISTS (
                SELECT 1 FROM profile_object_permissions
                WHERE profile_id = v_profile_id AND object_type = v_object_type
            ) THEN
                UPDATE profile_object_permissions
                SET 
                    access_level = 'Read',
                    can_create = FALSE,
                    can_read = TRUE,
                    can_edit = FALSE,
                    can_delete = FALSE,
                    can_view_all = TRUE, -- Viewers can see all records
                    updated_at = NOW()
                WHERE profile_id = v_profile_id AND object_type = v_object_type;
            ELSE
                INSERT INTO profile_object_permissions (
                    profile_id, object_type, access_level,
                    can_create, can_read, can_edit, can_delete, can_view_all,
                    created_at, updated_at
                ) VALUES (
                    v_profile_id, v_object_type, 'Read',
                    FALSE, TRUE, FALSE, FALSE, TRUE,
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Viewer profile permissions set';
    END IF;

    RAISE NOTICE 'Successfully set permissions for all system profiles';
END $$;

