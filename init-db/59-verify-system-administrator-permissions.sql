-- =====================================================
-- Verify System Administrator Has All Access
-- This script verifies that System Administrator profile
-- has complete access to all objects and fields
-- =====================================================

DO $$
DECLARE
    v_admin_profile_id UUID;
    v_object_type TEXT;
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
    v_missing_objects TEXT[] := ARRAY[]::TEXT[];
    v_missing_permissions INTEGER := 0;
    v_total_objects INTEGER := 0;
    v_total_fields INTEGER := 0;
    v_missing_fields INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verifying System Administrator Permissions';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Find System Administrator profile
    SELECT id INTO v_admin_profile_id
    FROM profiles
    WHERE (
        name = 'System Administrator' 
        OR name = 'Global Administrator'
        OR name = 'Administrateur Système'
        OR display_name = 'System Administrator'
        OR display_name = 'Global Administrator'
    )
    AND is_system_profile = TRUE
    AND organization_id IS NULL
    LIMIT 1;
    
    IF v_admin_profile_id IS NULL THEN
        RAISE EXCEPTION 'System Administrator profile not found. Please run init-db/56-create-missing-profiles.sql first.';
    END IF;
    
    RAISE NOTICE 'Found System Administrator profile: %', v_admin_profile_id;
    RAISE NOTICE '';
    
    -- ============================================================
    -- 1. VERIFY OBJECT-LEVEL PERMISSIONS
    -- ============================================================
    RAISE NOTICE 'Checking object-level permissions...';
    
    FOREACH v_object_type IN ARRAY v_object_types
    LOOP
        v_total_objects := v_total_objects + 1;
        
        -- Check if permission exists and has full access
        IF NOT EXISTS (
            SELECT 1 FROM profile_object_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = v_object_type
              AND access_level = 'All'
              AND can_create = TRUE
              AND can_read = TRUE
              AND can_edit = TRUE
              AND can_delete = TRUE
              AND can_view_all = TRUE
        ) THEN
            v_missing_objects := array_append(v_missing_objects, v_object_type);
            v_missing_permissions := v_missing_permissions + 1;
            RAISE WARNING '  ✗ Missing or incomplete permissions for %', v_object_type;
        ELSE
            RAISE NOTICE '  ✓ Full access to %', v_object_type;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Object-level permissions: %/% objects have full access', 
        v_total_objects - v_missing_permissions, v_total_objects;
    
    -- ============================================================
    -- 2. VERIFY FIELD-LEVEL PERMISSIONS
    -- ============================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Checking field-level permissions...';
    
    -- Count total fields and missing fields
    SELECT 
        COUNT(DISTINCT object_type || '.' || field_name) INTO v_total_fields
    FROM (
        SELECT 'Property' AS object_type, unnest(ARRAY['name', 'address', 'city', 'propertyType', 'totalUnits', 'notes', 'latitude', 'longitude', 'purchasePrice', 'purchaseDate', 'mortgageDetails']) AS field_name
        UNION ALL
        SELECT 'Unit', unnest(ARRAY['unitNumber', 'floor', 'surface', 'rentAmount', 'chargesAmount', 'depositAmount', 'status', 'amenities'])
        UNION ALL
        SELECT 'Tenant', unnest(ARRAY['firstName', 'lastName', 'email', 'phone', 'idNumber', 'bankDetails', 'emergencyContact', 'birthDate', 'socialSecurityNumber'])
        UNION ALL
        SELECT 'Lease', unnest(ARRAY['startDate', 'endDate', 'rentAmount', 'depositAmount', 'terms', 'status', 'notes'])
        UNION ALL
        SELECT 'Payment', unnest(ARRAY['amount', 'paymentMethod', 'transactionId', 'bankDetails', 'dueDate', 'status', 'reference', 'notes'])
        UNION ALL
        SELECT 'Task', unnest(ARRAY['title', 'description', 'assignedTo', 'dueDate', 'priority', 'status'])
        UNION ALL
        SELECT 'Message', unnest(ARRAY['content', 'attachments', 'readAt', 'senderType'])
        UNION ALL
        SELECT 'JournalEntry', unnest(ARRAY['entryDate', 'description', 'debit', 'credit', 'account', 'reference'])
        UNION ALL
        SELECT 'User', unnest(ARRAY['email', 'phone', 'firstName', 'lastName', 'role', 'avatarUrl', 'isActive', 'salary'])
        UNION ALL
        SELECT 'Organization', unnest(ARRAY['name', 'slug', 'type', 'country', 'stripeCustomerId', 'billingEmail', 'plan'])
        UNION ALL
        SELECT 'Profile', unnest(ARRAY['name', 'display_name', 'description', 'is_system_profile', 'is_active', 'organization_id', 'permissions'])
        UNION ALL
        SELECT 'Report', unnest(ARRAY['name', 'type', 'dateRange', 'filters', 'generatedAt', 'data'])
        UNION ALL
        SELECT 'Activity', unnest(ARRAY['type', 'description', 'timestamp', 'userId', 'entityType', 'entityId', 'details', 'metadata'])
    ) AS all_fields;
    
    SELECT COUNT(*) INTO v_missing_fields
    FROM (
        SELECT 'Property' AS object_type, unnest(ARRAY['name', 'address', 'city', 'propertyType', 'totalUnits', 'notes', 'latitude', 'longitude', 'purchasePrice', 'purchaseDate', 'mortgageDetails']) AS field_name
        UNION ALL
        SELECT 'Unit', unnest(ARRAY['unitNumber', 'floor', 'surface', 'rentAmount', 'chargesAmount', 'depositAmount', 'status', 'amenities'])
        UNION ALL
        SELECT 'Tenant', unnest(ARRAY['firstName', 'lastName', 'email', 'phone', 'idNumber', 'bankDetails', 'emergencyContact', 'birthDate', 'socialSecurityNumber'])
        UNION ALL
        SELECT 'Lease', unnest(ARRAY['startDate', 'endDate', 'rentAmount', 'depositAmount', 'terms', 'status', 'notes'])
        UNION ALL
        SELECT 'Payment', unnest(ARRAY['amount', 'paymentMethod', 'transactionId', 'bankDetails', 'dueDate', 'status', 'reference', 'notes'])
        UNION ALL
        SELECT 'Task', unnest(ARRAY['title', 'description', 'assignedTo', 'dueDate', 'priority', 'status'])
        UNION ALL
        SELECT 'Message', unnest(ARRAY['content', 'attachments', 'readAt', 'senderType'])
        UNION ALL
        SELECT 'JournalEntry', unnest(ARRAY['entryDate', 'description', 'debit', 'credit', 'account', 'reference'])
        UNION ALL
        SELECT 'User', unnest(ARRAY['email', 'phone', 'firstName', 'lastName', 'role', 'avatarUrl', 'isActive', 'salary'])
        UNION ALL
        SELECT 'Organization', unnest(ARRAY['name', 'slug', 'type', 'country', 'stripeCustomerId', 'billingEmail', 'plan'])
        UNION ALL
        SELECT 'Profile', unnest(ARRAY['name', 'display_name', 'description', 'is_system_profile', 'is_active', 'organization_id', 'permissions'])
        UNION ALL
        SELECT 'Report', unnest(ARRAY['name', 'type', 'dateRange', 'filters', 'generatedAt', 'data'])
        UNION ALL
        SELECT 'Activity', unnest(ARRAY['type', 'description', 'timestamp', 'userId', 'entityType', 'entityId', 'details', 'metadata'])
    ) AS all_fields
    WHERE NOT EXISTS (
        SELECT 1 FROM profile_field_permissions
        WHERE profile_id = v_admin_profile_id
          AND profile_field_permissions.object_type = all_fields.object_type
          AND profile_field_permissions.field_name = all_fields.field_name
          AND access_level = 'ReadWrite'
          AND can_read = TRUE
          AND can_edit = TRUE
    );
    
    RAISE NOTICE 'Field-level permissions: %/% fields have ReadWrite access', 
        v_total_fields - v_missing_fields, v_total_fields;
    
    -- ============================================================
    -- 3. SUMMARY
    -- ============================================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    IF v_missing_permissions = 0 AND v_missing_fields = 0 THEN
        RAISE NOTICE '✓ System Administrator has FULL ACCESS to all objects and fields';
        RAISE NOTICE '✓ All permissions are correctly configured';
    ELSE
        RAISE WARNING '✗ System Administrator is missing some permissions:';
        IF v_missing_permissions > 0 THEN
            RAISE WARNING '  - Missing object permissions: %', array_to_string(v_missing_objects, ', ');
        END IF;
        IF v_missing_fields > 0 THEN
            RAISE WARNING '  - Missing field permissions: % fields', v_missing_fields;
        END IF;
        RAISE NOTICE '';
        RAISE NOTICE 'To fix, run: init-db/55-grant-full-access-to-system-administrator.sql';
    END IF;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

