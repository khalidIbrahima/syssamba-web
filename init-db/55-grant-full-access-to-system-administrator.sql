-- =====================================================
-- Grant Full Access to System Administrator Profile
-- This script ensures the System Administrator profile
-- has complete access to all objects and fields
-- =====================================================

DO $$
DECLARE
    v_admin_profile_id UUID;
    v_object_type TEXT;
    v_field_name TEXT;
    
    -- All object types in the system
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
        'Profile',
        'Report',
        'Activity'
    ];
    
    -- Field definitions for each object type
    v_property_fields TEXT[] := ARRAY['name', 'address', 'city', 'propertyType', 'totalUnits', 'notes', 'latitude', 'longitude', 'purchasePrice', 'purchaseDate', 'mortgageDetails'];
    v_unit_fields TEXT[] := ARRAY['unitNumber', 'floor', 'surface', 'rentAmount', 'chargesAmount', 'depositAmount', 'status', 'amenities'];
    v_tenant_fields TEXT[] := ARRAY['firstName', 'lastName', 'email', 'phone', 'idNumber', 'bankDetails', 'emergencyContact', 'birthDate', 'socialSecurityNumber'];
    v_lease_fields TEXT[] := ARRAY['startDate', 'endDate', 'rentAmount', 'depositAmount', 'terms', 'status', 'notes'];
    v_payment_fields TEXT[] := ARRAY['amount', 'paymentMethod', 'transactionId', 'bankDetails', 'dueDate', 'status', 'reference', 'notes'];
    v_task_fields TEXT[] := ARRAY['title', 'description', 'assignedTo', 'dueDate', 'priority', 'status'];
    v_message_fields TEXT[] := ARRAY['content', 'attachments', 'readAt', 'senderType'];
    v_journal_entry_fields TEXT[] := ARRAY['entryDate', 'description', 'debit', 'credit', 'account', 'reference'];
    v_user_fields TEXT[] := ARRAY['email', 'phone', 'firstName', 'lastName', 'role', 'avatarUrl', 'isActive', 'salary'];
    v_organization_fields TEXT[] := ARRAY['name', 'slug', 'type', 'country', 'stripeCustomerId', 'billingEmail', 'plan'];
    v_profile_fields TEXT[] := ARRAY['name', 'display_name', 'description', 'is_system_profile', 'is_active', 'organization_id', 'permissions'];
    v_report_fields TEXT[] := ARRAY['name', 'type', 'dateRange', 'filters', 'generatedAt', 'data'];
    v_activity_fields TEXT[] := ARRAY['type', 'description', 'timestamp', 'userId', 'entityType', 'entityId', 'details', 'metadata'];
    
    v_field_array TEXT[];
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Granting Full Access to System Administrator';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Find System Administrator profile (ONLY System Administrator, not Global Administrator)
    SELECT id INTO v_admin_profile_id
    FROM profiles
    WHERE name = 'System Administrator'
      AND is_system_profile = TRUE
      AND organization_id IS NULL
    LIMIT 1;
    
    IF v_admin_profile_id IS NULL THEN
        RAISE EXCEPTION 'System Administrator profile not found. Please ensure the profile exists.';
    END IF;
    
    RAISE NOTICE 'Found System Administrator profile: %', v_admin_profile_id;
    RAISE NOTICE '';
    
    -- ============================================================
    -- 1. GRANT ALL OBJECT-LEVEL PERMISSIONS
    -- ============================================================
    RAISE NOTICE 'Granting object-level permissions...';
    
    FOREACH v_object_type IN ARRAY v_object_types
    LOOP
        -- Insert or update object-level permission with full access
        INSERT INTO profile_object_permissions (
            profile_id,
            object_type,
            access_level,
            can_create,
            can_read,
            can_edit,
            can_delete,
            can_view_all,
            created_at,
            updated_at
        ) VALUES (
            v_admin_profile_id,
            v_object_type,
            'All',
            TRUE,
            TRUE,
            TRUE,
            TRUE,
            TRUE,
            NOW(),
            NOW()
        )
        ON CONFLICT (profile_id, object_type)
        DO UPDATE SET
            access_level = 'All',
            can_create = TRUE,
            can_read = TRUE,
            can_edit = TRUE,
            can_delete = TRUE,
            can_view_all = TRUE,
            updated_at = NOW();
        
        RAISE NOTICE '  ✓ Granted full access to %', v_object_type;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Object-level permissions granted';
    RAISE NOTICE '';
    
    -- ============================================================
    -- 2. GRANT ALL FIELD-LEVEL PERMISSIONS
    -- ============================================================
    RAISE NOTICE 'Granting field-level permissions...';
    
    -- Property fields
    FOREACH v_field_name IN ARRAY v_property_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Property', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Property fields';
    
    -- Unit fields
    FOREACH v_field_name IN ARRAY v_unit_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Unit', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Unit fields';
    
    -- Tenant fields
    FOREACH v_field_name IN ARRAY v_tenant_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Tenant', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Tenant fields';
    
    -- Lease fields
    FOREACH v_field_name IN ARRAY v_lease_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Lease', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Lease fields';
    
    -- Payment fields
    FOREACH v_field_name IN ARRAY v_payment_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Payment', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Payment fields';
    
    -- Task fields
    FOREACH v_field_name IN ARRAY v_task_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Task', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Task fields';
    
    -- Message fields
    FOREACH v_field_name IN ARRAY v_message_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Message', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Message fields';
    
    -- JournalEntry fields
    FOREACH v_field_name IN ARRAY v_journal_entry_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'JournalEntry', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ JournalEntry fields';
    
    -- User fields
    FOREACH v_field_name IN ARRAY v_user_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'User', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ User fields';
    
    -- Organization fields
    FOREACH v_field_name IN ARRAY v_organization_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Organization', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Organization fields';
    
    -- Profile fields (important for profile management)
    FOREACH v_field_name IN ARRAY v_profile_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Profile', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Profile fields';
    
    -- Report fields
    FOREACH v_field_name IN ARRAY v_report_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Report', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Report fields';
    
    -- Activity fields
    FOREACH v_field_name IN ARRAY v_activity_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_admin_profile_id, 'Activity', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Activity fields';
    
    RAISE NOTICE '';
    
    -- ============================================================
    -- 3. UPDATE PERMISSIONS JSONB FIELD (if column exists)
    -- ============================================================
    RAISE NOTICE 'Updating permissions JSONB field...';
    
    -- Check if permissions column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'permissions'
    ) THEN
        -- Update permissions JSONB field with all access
        UPDATE profiles
        SET 
            permissions = '{
                "allAccess": true,
                "unlimited": true,
                "bypassSecurity": true,
                "systemAdmin": true,
                "canManageAllOrganizations": true,
                "canManageAllUsers": true,
                "canManageAllProfiles": true,
                "canManageSystemSettings": true,
                "canBypassPlanLimits": true,
                "canAccessAllData": true
            }'::jsonb,
            updated_at = NOW()
        WHERE id = v_admin_profile_id;
        
        RAISE NOTICE '  ✓ Updated permissions JSONB field';
    ELSE
        RAISE NOTICE '  ⚠ Permissions column does not exist, skipping JSONB update';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Successfully granted full access to System Administrator';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Note: To update the full permissions JSONB field with detailed object and field permissions,';
    RAISE NOTICE '      run: init-db/60-update-system-administrator-permissions-field.sql';
    RAISE NOTICE '';
END $$;

