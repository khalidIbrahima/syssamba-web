-- Grant all permissions to Admin profile
-- This script gives the Admin profile full access to all objects and fields

DO $$
DECLARE
    v_admin_profile_id UUID;
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
    -- Find the Admin profile (global system profile)
    -- Try both 'Admin' and 'Administrateur' (French name)
    SELECT id INTO v_admin_profile_id
    FROM profiles
    WHERE (name = 'Admin' OR name = 'Administrateur')
      AND is_global = TRUE 
      AND is_system_profile = TRUE
      AND organization_id IS NULL  -- Ensure it's truly global
    LIMIT 1;

    IF v_admin_profile_id IS NULL THEN
        -- If not found, try to find any Admin profile and fix it
        SELECT id INTO v_admin_profile_id
        FROM profiles
        WHERE (name = 'Admin' OR name = 'Administrateur')
          AND is_system_profile = TRUE
        LIMIT 1;
        
        -- If found but not global, fix it
        IF v_admin_profile_id IS NOT NULL THEN
            UPDATE profiles
            SET is_global = TRUE,
                organization_id = NULL
            WHERE id = v_admin_profile_id;
            RAISE NOTICE 'Fixed Admin profile to be global';
        ELSE
            RAISE EXCEPTION 'Admin profile not found. Please ensure the profile exists.';
        END IF;
    END IF;

    RAISE NOTICE 'Found Admin profile: %', v_admin_profile_id;

    -- Grant all object-level permissions for each object type
    FOREACH v_object_type IN ARRAY v_object_types
    LOOP
        -- Check if permission already exists
        IF EXISTS (
            SELECT 1 FROM profile_object_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = v_object_type
        ) THEN
            -- Update existing permission
            UPDATE profile_object_permissions
            SET 
                access_level = 'All',
                can_create = TRUE,
                can_read = TRUE,
                can_edit = TRUE,
                can_delete = TRUE,
                can_view_all = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = v_object_type;
            
            RAISE NOTICE 'Updated object permission for %', v_object_type;
        ELSE
            -- Insert new permission
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
            );
            
            RAISE NOTICE 'Created object permission for %', v_object_type;
        END IF;
    END LOOP;

    -- Grant all field-level permissions
    -- For each object type, we'll grant read and edit access to all common fields
    -- Note: In production, you might want to query the actual schema to get all fields
    
    -- Property fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['name', 'address', 'city', 'propertyType', 'totalUnits', 'notes', 'latitude', 'longitude', 'purchasePrice', 'purchaseDate', 'mortgageDetails']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Property'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Property',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('purchasePrice', 'purchaseDate', 'mortgageDetails') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Property'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- Unit fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['unitNumber', 'floor', 'surface', 'rentAmount', 'chargesAmount', 'depositAmount', 'status', 'amenities']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Unit'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Unit',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('rentAmount', 'chargesAmount', 'depositAmount') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Unit'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- Tenant fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['firstName', 'lastName', 'email', 'phone', 'birthDate', 'socialSecurityNumber', 'emergencyContact', 'idNumber', 'bankDetails']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Tenant'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Tenant',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('email', 'phone', 'idNumber', 'bankDetails', 'socialSecurityNumber') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Tenant'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- Lease fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['startDate', 'endDate', 'rentAmount', 'chargesAmount', 'depositAmount', 'status', 'notes', 'terms']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Lease'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Lease',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('rentAmount', 'depositAmount', 'terms') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Lease'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- Payment fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['amount', 'paymentDate', 'paymentMethod', 'status', 'reference', 'notes', 'transactionId', 'bankDetails']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Payment'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Payment',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('amount', 'paymentMethod', 'transactionId', 'bankDetails') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Payment'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- Task fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['title', 'description', 'status', 'priority', 'dueDate', 'assignedTo']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Task'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Task',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('assignedTo', 'dueDate', 'priority') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Task'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- Message fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['content', 'attachments', 'readAt', 'senderType']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Message'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Message',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('content', 'attachments') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Message'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- JournalEntry fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['entryDate', 'description', 'debit', 'credit', 'account', 'reference']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'JournalEntry'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'JournalEntry',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('amount', 'account', 'description') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'JournalEntry'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- User fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['firstName', 'lastName', 'email', 'phone', 'role', 'isActive', 'avatarUrl', 'salary']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'User'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'User',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('email', 'phone', 'role', 'salary') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'User'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- Organization fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['stripeCustomerId', 'billingEmail', 'plan']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Organization'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Organization',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                TRUE, -- All organization fields are sensitive
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Organization'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- Report fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['name', 'type', 'dateRange', 'filters', 'generatedAt', 'data']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Report'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Report',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('data', 'filters') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Report'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    -- Activity fields
    FOR v_field_permissions IN 
        SELECT unnest(ARRAY['type', 'description', 'timestamp', 'userId', 'entityType', 'entityId', 'details', 'metadata']) AS field_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM profile_field_permissions
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Activity'
              AND field_name = v_field_permissions.field_name
        ) THEN
            INSERT INTO profile_field_permissions (
                profile_id,
                object_type,
                field_name,
                access_level,
                can_read,
                can_edit,
                is_sensitive,
                created_at,
                updated_at
            ) VALUES (
                v_admin_profile_id,
                'Activity',
                v_field_permissions.field_name,
                'ReadWrite',
                TRUE,
                TRUE,
                CASE WHEN v_field_permissions.field_name IN ('details', 'metadata') THEN TRUE ELSE FALSE END,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE profile_field_permissions
            SET 
                access_level = 'ReadWrite',
                can_read = TRUE,
                can_edit = TRUE,
                updated_at = NOW()
            WHERE profile_id = v_admin_profile_id
              AND object_type = 'Activity'
              AND field_name = v_field_permissions.field_name;
        END IF;
    END LOOP;

    RAISE NOTICE 'Successfully granted all permissions to Admin profile';
END $$;

