-- =====================================================
-- Load Profile Permissions Data
-- This script loads default permissions for all profiles
-- into profile_object_permissions and profile_field_permissions tables
-- =====================================================

DO $$
DECLARE
    v_profile_id UUID;
    v_profile_name TEXT;
    v_profile_record RECORD;
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
        'Report',
        'Activity'
    ];
    
    -- Field definitions for each object type
    v_property_fields TEXT[] := ARRAY['name', 'address', 'city', 'propertyType', 'totalUnits', 'notes', 'latitude', 'longitude', 'purchasePrice', 'purchaseDate', 'mortgageDetails'];
    v_unit_fields TEXT[] := ARRAY['unitNumber', 'floor', 'surface', 'rentAmount', 'chargesAmount', 'depositAmount', 'status', 'amenities'];
    v_tenant_fields TEXT[] := ARRAY['firstName', 'lastName', 'email', 'phone', 'idNumber', 'bankDetails', 'emergencyContact'];
    v_lease_fields TEXT[] := ARRAY['startDate', 'endDate', 'rentAmount', 'depositAmount', 'terms', 'status'];
    v_payment_fields TEXT[] := ARRAY['amount', 'paymentMethod', 'transactionId', 'bankDetails', 'dueDate', 'status'];
    v_task_fields TEXT[] := ARRAY['title', 'description', 'assignedTo', 'dueDate', 'priority', 'status'];
    v_message_fields TEXT[] := ARRAY['content', 'attachments', 'readAt'];
    v_journal_entry_fields TEXT[] := ARRAY['amount', 'account', 'description', 'date', 'reference'];
    v_user_fields TEXT[] := ARRAY['email', 'phone', 'firstName', 'lastName', 'role', 'avatarUrl'];
    v_organization_fields TEXT[] := ARRAY['name', 'slug', 'type', 'country', 'stripeCustomerId', 'billingEmail', 'plan'];
    v_report_fields TEXT[] := ARRAY['name', 'type', 'data', 'filters', 'generatedAt'];
    v_activity_fields TEXT[] := ARRAY['type', 'details', 'metadata', 'timestamp'];
    
    -- Sensitive fields (marked as sensitive for FLS)
    v_sensitive_fields TEXT[] := ARRAY[
        'purchasePrice', 'purchaseDate', 'mortgageDetails',  -- Property
        'rentAmount', 'chargesAmount', 'depositAmount',      -- Unit
        'email', 'phone', 'idNumber', 'bankDetails',         -- Tenant
        'rentAmount', 'depositAmount', 'terms',              -- Lease
        'amount', 'paymentMethod', 'transactionId', 'bankDetails', -- Payment
        'content', 'attachments',                            -- Message
        'amount', 'account', 'description',                  -- JournalEntry
        'email', 'phone', 'role', 'salary',                  -- User
        'stripeCustomerId', 'billingEmail', 'plan',          -- Organization
        'data', 'filters',                                    -- Report
        'details', 'metadata'                                 -- Activity
    ];
    
    v_field_array TEXT[];
    v_is_sensitive BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting to load profile permissions data...';
    
    -- Loop through all active profiles (both global and organization-specific)
    FOR v_profile_record IN 
        SELECT id, name, organization_id, is_system_profile
        FROM profiles
        WHERE is_active = TRUE
        ORDER BY organization_id NULLS FIRST, name
    LOOP
        v_profile_id := v_profile_record.id;
        v_profile_name := v_profile_record.name;
        
        RAISE NOTICE 'Processing profile: % (ID: %, Org: %)', 
            v_profile_name, v_profile_id, v_profile_record.organization_id;
        
        -- ============================================================
        -- 1. LOAD OBJECT-LEVEL PERMISSIONS
        -- ============================================================
        
        -- Determine permissions based on profile name
        FOREACH v_object_type IN ARRAY v_object_types
        LOOP
            -- Determine access level based on profile
            DECLARE
                v_access_level TEXT;
                v_can_create BOOLEAN;
                v_can_read BOOLEAN;
                v_can_edit BOOLEAN;
                v_can_delete BOOLEAN;
                v_can_view_all BOOLEAN;
            BEGIN
                -- Set permissions based on profile type
                IF v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin') THEN
                    -- Full access for Owner and Admin profiles
                    v_access_level := 'All';
                    v_can_create := TRUE;
                    v_can_read := TRUE;
                    v_can_edit := TRUE;
                    v_can_delete := TRUE;
                    v_can_view_all := TRUE;
                    
                ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                    -- Accountant: Full access to financial objects, read-only for others
                    IF v_object_type IN ('Payment', 'JournalEntry', 'Report', 'Activity') THEN
                        v_access_level := 'All';
                        v_can_create := TRUE;
                        v_can_read := TRUE;
                        v_can_edit := TRUE;
                        v_can_delete := TRUE;
                        v_can_view_all := TRUE;
                    ELSE
                        v_access_level := 'Read';
                        v_can_create := FALSE;
                        v_can_read := TRUE;
                        v_can_edit := FALSE;
                        v_can_delete := FALSE;
                        v_can_view_all := TRUE;
                    END IF;
                    
                ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                    -- Agent: ReadWrite access to operational objects
                    IF v_object_type IN ('Property', 'Unit', 'Tenant', 'Lease', 'Task', 'Message') THEN
                        v_access_level := 'ReadWrite';
                        v_can_create := TRUE;
                        v_can_read := TRUE;
                        v_can_edit := TRUE;
                        v_can_delete := FALSE; -- Agents cannot delete
                        v_can_view_all := TRUE;
                    ELSE
                        v_access_level := 'Read';
                        v_can_create := FALSE;
                        v_can_read := TRUE;
                        v_can_edit := FALSE;
                        v_can_delete := FALSE;
                        v_can_view_all := FALSE;
                    END IF;
                    
                ELSE
                    -- Viewer/Lecteur: Read-only access
                    v_access_level := 'Read';
                    v_can_create := FALSE;
                    v_can_read := TRUE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := FALSE;
                END IF;
                
                -- Insert or update object permission
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
                    v_profile_id,
                    v_object_type,
                    v_access_level,
                    v_can_create,
                    v_can_read,
                    v_can_edit,
                    v_can_delete,
                    v_can_view_all,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (profile_id, object_type) 
                DO UPDATE SET
                    access_level = EXCLUDED.access_level,
                    can_create = EXCLUDED.can_create,
                    can_read = EXCLUDED.can_read,
                    can_edit = EXCLUDED.can_edit,
                    can_delete = EXCLUDED.can_delete,
                    can_view_all = EXCLUDED.can_view_all,
                    updated_at = NOW();
            END;
        END LOOP;
        
        RAISE NOTICE 'Object-level permissions loaded for profile: %', v_profile_name;
        
        -- ============================================================
        -- 2. LOAD FIELD-LEVEL PERMISSIONS
        -- ============================================================
        
        -- Property fields
        v_field_array := v_property_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
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
                v_profile_id,
                'Property',
                v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin') THEN 'ReadWrite'
                    WHEN v_profile_name IN ('Comptable', 'Accountant') AND v_is_sensitive THEN 'Read'
                    WHEN v_profile_name IN ('Agent', 'Agent') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Lecteur', 'Viewer') AND v_is_sensitive THEN FALSE ELSE TRUE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Agent', 'Agent') AND NOT v_is_sensitive THEN TRUE ELSE FALSE END,
                v_is_sensitive,
                NOW(),
                NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET
                access_level = EXCLUDED.access_level,
                can_read = EXCLUDED.can_read,
                can_edit = EXCLUDED.can_edit,
                is_sensitive = EXCLUDED.is_sensitive,
                updated_at = NOW();
        END LOOP;
        
        -- Unit fields
        v_field_array := v_unit_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Unit', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin') THEN 'ReadWrite'
                    WHEN v_profile_name IN ('Comptable', 'Accountant') AND v_is_sensitive THEN 'Read'
                    WHEN v_profile_name IN ('Agent', 'Agent') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Lecteur', 'Viewer') AND v_is_sensitive THEN FALSE ELSE TRUE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Agent', 'Agent') AND NOT v_is_sensitive THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Tenant fields
        v_field_array := v_tenant_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Tenant', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin') THEN 'ReadWrite'
                    WHEN v_profile_name IN ('Comptable', 'Accountant') AND v_is_sensitive THEN 'Read'
                    WHEN v_profile_name IN ('Agent', 'Agent') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Lecteur', 'Viewer') AND v_is_sensitive THEN FALSE ELSE TRUE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Agent', 'Agent') AND NOT v_is_sensitive THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Lease fields
        v_field_array := v_lease_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Lease', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin') THEN 'ReadWrite'
                    WHEN v_profile_name IN ('Comptable', 'Accountant') AND v_is_sensitive THEN 'Read'
                    WHEN v_profile_name IN ('Agent', 'Agent') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Lecteur', 'Viewer') AND v_is_sensitive THEN FALSE ELSE TRUE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Agent', 'Agent') AND NOT v_is_sensitive THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Payment fields
        v_field_array := v_payment_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Payment', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Comptable', 'Accountant') THEN 'ReadWrite'
                    WHEN v_profile_name IN ('Agent', 'Agent') THEN 'Read'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Lecteur', 'Viewer') AND v_is_sensitive THEN FALSE ELSE TRUE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Comptable', 'Accountant') THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Task fields
        v_field_array := v_task_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Task', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Agent', 'Agent') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                TRUE,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Agent', 'Agent') THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Message fields
        v_field_array := v_message_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Message', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Agent', 'Agent') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                TRUE,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Agent', 'Agent') THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- JournalEntry fields
        v_field_array := v_journal_entry_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'JournalEntry', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Comptable', 'Accountant') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Comptable', 'Accountant') THEN TRUE ELSE FALSE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Comptable', 'Accountant') THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- User fields
        v_field_array := v_user_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'User', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Lecteur', 'Viewer') AND v_is_sensitive THEN FALSE ELSE TRUE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin') THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Organization fields
        v_field_array := v_organization_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Organization', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Lecteur', 'Viewer') AND v_is_sensitive THEN FALSE ELSE TRUE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin') THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Report fields
        v_field_array := v_report_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Report', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Comptable', 'Accountant') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Lecteur', 'Viewer') AND v_is_sensitive THEN FALSE ELSE TRUE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Comptable', 'Accountant') THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Activity fields
        v_field_array := v_activity_fields;
        FOREACH v_field_name IN ARRAY v_field_array
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Activity', v_field_name,
                CASE 
                    WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Comptable', 'Accountant') THEN 'ReadWrite'
                    ELSE 'Read'
                END,
                CASE WHEN v_profile_name IN ('Lecteur', 'Viewer') AND v_is_sensitive THEN FALSE ELSE TRUE END,
                CASE WHEN v_profile_name IN ('Propriétaire', 'Owner', 'Organization Administrator', 'Administrateur', 'Admin', 'Comptable', 'Accountant') THEN TRUE ELSE FALSE END,
                v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        RAISE NOTICE 'Field-level permissions loaded for profile: %', v_profile_name;
    END LOOP;
    
    RAISE NOTICE 'Profile permissions data loading completed successfully!';
    RAISE NOTICE 'Total profiles processed: %', (SELECT COUNT(*) FROM profiles WHERE is_active = TRUE);
    RAISE NOTICE 'Total object permissions: %', (SELECT COUNT(*) FROM profile_object_permissions);
    RAISE NOTICE 'Total field permissions: %', (SELECT COUNT(*) FROM profile_field_permissions);
END $$;

-- Verify the data
SELECT 
    p.name AS profile_name,
    p.organization_id,
    COUNT(DISTINCT pop.object_type) AS object_permissions_count,
    COUNT(DISTINCT pfp.field_name) AS field_permissions_count
FROM profiles p
LEFT JOIN profile_object_permissions pop ON p.id = pop.profile_id
LEFT JOIN profile_field_permissions pfp ON p.id = pfp.profile_id
WHERE p.is_active = TRUE
GROUP BY p.id, p.name, p.organization_id
ORDER BY p.organization_id NULLS FIRST, p.name;

