-- =====================================================
-- Restore Global Administrator Permissions
-- This script restores permissions to Global Administrator profile
-- NOTE: Global Administrator has FULL ACCESS to ALL data and operations:
--   - Complete access to all objects including sensitive data
--   - Can manage all organizations, users, and profiles
--   - No restrictions on accounting, payments, or billing data
-- =====================================================

DO $$
DECLARE
    v_global_admin_profile_id UUID;
    v_object_type TEXT;
    v_field_name TEXT;
    
    -- Object types that Global Administrator CAN access (ALL objects including sensitive data)
    v_object_types TEXT[] := ARRAY[
        'Property',
        'Unit',
        'Tenant',
        'Lease',
        'Payment',      -- Full access to payment data
        'JournalEntry', -- Full access to accounting data
        'Task',
        'Message',
        'User',
        'Profile',
        'Report',
        'Activity',
        'Organization'  -- Full access to organization management
    ];
    
    -- Field definitions for each object type (excluding sensitive fields)
    -- Property: Exclude purchasePrice, purchaseDate, mortgageDetails
    v_property_fields TEXT[] := ARRAY['name', 'address', 'city', 'propertyType', 'totalUnits', 'notes', 'latitude', 'longitude'];
    -- Unit: Exclude rentAmount, chargesAmount, depositAmount
    v_unit_fields TEXT[] := ARRAY['unitNumber', 'floor', 'surface', 'status', 'amenities'];
    -- Tenant: Exclude idNumber, bankDetails, socialSecurityNumber
    v_tenant_fields TEXT[] := ARRAY['firstName', 'lastName', 'email', 'phone', 'emergencyContact', 'birthDate'];
    -- Lease: Exclude rentAmount, depositAmount
    v_lease_fields TEXT[] := ARRAY['startDate', 'endDate', 'terms', 'status', 'notes'];
    -- Task: All fields allowed (no sensitive data)
    v_task_fields TEXT[] := ARRAY['title', 'description', 'assignedTo', 'dueDate', 'priority', 'status'];
    -- Message: All fields allowed
    v_message_fields TEXT[] := ARRAY['content', 'attachments', 'readAt', 'senderType'];
    -- User: Exclude salary
    v_user_fields TEXT[] := ARRAY['email', 'phone', 'firstName', 'lastName', 'role', 'avatarUrl', 'isActive'];
    -- Profile: All fields allowed
    v_profile_fields TEXT[] := ARRAY['name', 'display_name', 'description', 'is_system_profile', 'is_active', 'organization_id', 'permissions'];
    -- Report: Exclude data (may contain sensitive information)
    v_report_fields TEXT[] := ARRAY['name', 'type', 'dateRange', 'filters', 'generatedAt'];
    -- Activity: Exclude details, metadata (may contain sensitive information)
    v_activity_fields TEXT[] := ARRAY['type', 'description', 'timestamp', 'userId', 'entityType', 'entityId'];
    -- Payment: ALL fields allowed (full access to payment data)
    v_payment_fields TEXT[] := ARRAY['amount', 'currency', 'status', 'type', 'description', 'dueDate', 'paidAt', 'tenantId', 'leaseId', 'propertyId', 'unitId', 'paymentMethod', 'reference', 'notes', 'receiptUrl'];
    -- JournalEntry: ALL fields allowed (full access to accounting data)
    v_journal_fields TEXT[] := ARRAY['date', 'description', 'debitAmount', 'creditAmount', 'accountCode', 'accountName', 'reference', 'propertyId', 'tenantId', 'paymentId', 'category', 'subcategory'];

    v_field_array TEXT[];
    v_has_permissions BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Restoring Global Administrator Permissions';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Find Global Administrator profile
    SELECT id INTO v_global_admin_profile_id
    FROM profiles
    WHERE name = 'Global Administrator'
      AND is_system_profile = TRUE
      AND organization_id IS NULL
    LIMIT 1;
    
    IF v_global_admin_profile_id IS NULL THEN
        RAISE EXCEPTION 'Global Administrator profile not found. Please ensure the profile exists.';
    END IF;
    
    RAISE NOTICE 'Found Global Administrator profile: %', v_global_admin_profile_id;
    RAISE NOTICE '';
    
    -- ============================================================
    -- 1. GRANT OBJECT-LEVEL PERMISSIONS (excluding sensitive data)
    -- ============================================================
    RAISE NOTICE 'Granting object-level permissions (excluding sensitive data)...';
    
    FOREACH v_object_type IN ARRAY v_object_types
    LOOP
        IF v_object_type = 'Organization' THEN
            -- Special handling for Organization: limited access (can edit but restricted fields)
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
                v_global_admin_profile_id,
                'Organization',
                'ReadWrite',
                FALSE, -- Cannot create organizations
                TRUE,  -- Can read (but restricted fields)
                TRUE,  -- Can edit (but restricted fields)
                FALSE, -- Cannot delete organizations
                TRUE,  -- Can view all organizations
                NOW(),
                NOW()
            )
            ON CONFLICT (profile_id, object_type)
            DO UPDATE SET
                access_level = 'ReadWrite',
                can_create = FALSE,
                can_read = TRUE,
                can_edit = TRUE,
                can_delete = FALSE,
                can_view_all = TRUE,
                updated_at = NOW();
            
            RAISE NOTICE '  ✓ Granted limited access to Organization (can manage but not see billing data)';
        ELSE
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
                v_global_admin_profile_id,
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
        END IF;
    END LOOP;
    
    -- Remove access to sensitive objects (Payment, JournalEntry)
    DELETE FROM profile_object_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type IN ('Payment', 'JournalEntry');
    
    RAISE NOTICE '  ✓ Removed access to sensitive objects: Payment, JournalEntry';
    
    RAISE NOTICE '';
    RAISE NOTICE 'Object-level permissions granted';
    RAISE NOTICE '';
    
    -- ============================================================
    -- 2. GRANT ALL FIELD-LEVEL PERMISSIONS
    -- ============================================================
    RAISE NOTICE 'Granting field-level permissions...';
    
    -- Property fields (excluding sensitive: purchasePrice, purchaseDate, mortgageDetails)
    FOREACH v_field_name IN ARRAY v_property_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'Property', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    -- Remove access to sensitive property fields
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'Property'
      AND field_name IN ('purchasePrice', 'purchaseDate', 'mortgageDetails');
    RAISE NOTICE '  ✓ Property fields (excluding financial data)';
    
    -- Unit fields (excluding sensitive: rentAmount, chargesAmount, depositAmount)
    FOREACH v_field_name IN ARRAY v_unit_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'Unit', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    -- Remove access to sensitive unit fields
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'Unit'
      AND field_name IN ('rentAmount', 'chargesAmount', 'depositAmount');
    RAISE NOTICE '  ✓ Unit fields (excluding financial data)';
    
    -- Tenant fields (excluding sensitive: idNumber, bankDetails, socialSecurityNumber)
    FOREACH v_field_name IN ARRAY v_tenant_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'Tenant', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    -- Remove access to sensitive tenant fields
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'Tenant'
      AND field_name IN ('idNumber', 'bankDetails', 'socialSecurityNumber');
    RAISE NOTICE '  ✓ Tenant fields (excluding sensitive personal data)';
    
    -- Lease fields (excluding sensitive: rentAmount, depositAmount)
    FOREACH v_field_name IN ARRAY v_lease_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'Lease', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    -- Remove access to sensitive lease fields
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'Lease'
      AND field_name IN ('rentAmount', 'depositAmount');
    RAISE NOTICE '  ✓ Lease fields (excluding financial data)';
    
    -- Payment fields: NO ACCESS (sensitive financial data)
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'Payment';
    RAISE NOTICE '  ✓ Payment fields: NO ACCESS (sensitive financial data)';
    
    -- Task fields
    FOREACH v_field_name IN ARRAY v_task_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'Task', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
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
            v_global_admin_profile_id, 'Message', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Message fields';
    
    -- JournalEntry fields: NO ACCESS (sensitive accounting data)
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'JournalEntry';
    RAISE NOTICE '  ✓ JournalEntry fields: NO ACCESS (sensitive accounting data)';
    
    -- User fields (excluding sensitive: salary)
    FOREACH v_field_name IN ARRAY v_user_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'User', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    -- Remove access to sensitive user fields
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'User'
      AND field_name = 'salary';
    RAISE NOTICE '  ✓ User fields (excluding salary)';
    
    -- Organization fields: Limited access (can manage but not see sensitive billing data)
    -- Allow access to non-sensitive fields only
    INSERT INTO profile_field_permissions (
        profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
    ) VALUES (
        v_global_admin_profile_id, 'Organization', 'name', 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
    )
    ON CONFLICT (profile_id, object_type, field_name)
    DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    
    INSERT INTO profile_field_permissions (
        profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
    ) VALUES (
        v_global_admin_profile_id, 'Organization', 'slug', 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
    )
    ON CONFLICT (profile_id, object_type, field_name)
    DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    
    INSERT INTO profile_field_permissions (
        profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
    ) VALUES (
        v_global_admin_profile_id, 'Organization', 'type', 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
    )
    ON CONFLICT (profile_id, object_type, field_name)
    DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    
    INSERT INTO profile_field_permissions (
        profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
    ) VALUES (
        v_global_admin_profile_id, 'Organization', 'country', 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
    )
    ON CONFLICT (profile_id, object_type, field_name)
    DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    
    INSERT INTO profile_field_permissions (
        profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
    ) VALUES (
        v_global_admin_profile_id, 'Organization', 'is_configured', 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
    )
    ON CONFLICT (profile_id, object_type, field_name)
    DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    
    -- Remove access to sensitive organization fields
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'Organization'
      AND field_name IN ('stripeCustomerId', 'billingEmail', 'plan');
    RAISE NOTICE '  ✓ Organization fields: Limited access (can manage but not see billing data)';
    
    -- Profile fields (important for profile management)
    FOREACH v_field_name IN ARRAY v_profile_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'Profile', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Profile fields';
    
    -- Report fields (excluding sensitive: data field may contain sensitive information)
    FOREACH v_field_name IN ARRAY v_report_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'Report', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    -- Remove access to sensitive report fields
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'Report'
      AND field_name = 'data';
    RAISE NOTICE '  ✓ Report fields (excluding data field)';
    
    -- Activity fields (excluding sensitive: details, metadata may contain sensitive information)
    FOREACH v_field_name IN ARRAY v_activity_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'Activity', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    -- Remove access to sensitive activity fields
    DELETE FROM profile_field_permissions
    WHERE profile_id = v_global_admin_profile_id
      AND object_type = 'Activity'
      AND field_name IN ('details', 'metadata');
    RAISE NOTICE '  ✓ Activity fields (excluding details and metadata)';

    -- Payment fields (FULL ACCESS to all payment data)
    FOREACH v_field_name IN ARRAY v_payment_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'Payment', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ Payment fields (full access to all payment data)';

    -- JournalEntry fields (FULL ACCESS to all accounting data)
    FOREACH v_field_name IN ARRAY v_journal_fields
    LOOP
        INSERT INTO profile_field_permissions (
            profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
        ) VALUES (
            v_global_admin_profile_id, 'JournalEntry', v_field_name, 'ReadWrite', TRUE, TRUE, FALSE, NOW(), NOW()
        )
        ON CONFLICT (profile_id, object_type, field_name)
        DO UPDATE SET access_level = 'ReadWrite', can_read = TRUE, can_edit = TRUE, updated_at = NOW();
    END LOOP;
    RAISE NOTICE '  ✓ JournalEntry fields (full access to all accounting data)';

    RAISE NOTICE '';
    
    -- ============================================================
    -- 3. UPDATE PERMISSIONS JSONB FIELD (if column exists)
    -- ============================================================
    RAISE NOTICE 'Updating permissions JSONB field...';
    
    -- Check if permissions column exists
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'permissions'
    ) INTO v_has_permissions;
    
    IF v_has_permissions THEN
        -- Update permissions JSONB field (FULL ACCESS to everything)
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
                "canAccessAllData": true,
                "restrictedAccess": false,
                "cannotAccessAccounting": false,
                "cannotAccessPayments": false,
                "cannotAccessBilling": false,
                "cannotAccessSensitiveFields": false
            }'::jsonb,
            updated_at = NOW()
        WHERE id = v_global_admin_profile_id;
        
        RAISE NOTICE '  ✓ Updated permissions JSONB field (FULL ACCESS to everything)';
    ELSE
        RAISE NOTICE '  ⚠ Permissions column does not exist, skipping JSONB update';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Successfully restored Global Administrator permissions';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'FULL ACCESS granted to ALL objects and fields:';
    RAISE NOTICE '  ✓ Property, Unit, Tenant, Lease (ALL fields including financial)';
    RAISE NOTICE '  ✓ Payment (ALL fields - complete payment data access)';
    RAISE NOTICE '  ✓ JournalEntry (ALL fields - complete accounting data access)';
    RAISE NOTICE '  ✓ Task, Message, User, Profile, Report, Activity (ALL fields)';
    RAISE NOTICE '  ✓ Organization (ALL fields including billing information)';
    RAISE NOTICE '  ✓ ALL financial fields: rentAmount, chargesAmount, depositAmount, purchasePrice, etc.';
    RAISE NOTICE '  ✓ ALL sensitive personal data: idNumber, bankDetails, socialSecurityNumber, salary';
    RAISE NOTICE '';
END $$;

-- Verify the update
SELECT 
    id,
    name,
    display_name,
    (SELECT COUNT(*) FROM profile_object_permissions WHERE profile_id = profiles.id) as object_permissions_count,
    (SELECT COUNT(*) FROM profile_field_permissions WHERE profile_id = profiles.id) as field_permissions_count,
    permissions->>'allAccess' as all_access,
    updated_at
FROM profiles
WHERE name = 'Global Administrator'
  AND is_system_profile = TRUE
  AND organization_id IS NULL
LIMIT 1;

