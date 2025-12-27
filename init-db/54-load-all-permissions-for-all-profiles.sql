-- =====================================================
-- Load All Permissions for All Profiles
-- This script ensures that ALL active profiles have
-- ALL object-level and field-level permissions defined
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
    v_report_fields TEXT[] := ARRAY['name', 'type', 'dateRange', 'filters', 'generatedAt', 'data'];
    v_activity_fields TEXT[] := ARRAY['type', 'description', 'timestamp', 'userId', 'entityType', 'entityId', 'details', 'metadata'];
    
    -- Sensitive fields (marked as sensitive for FLS)
    v_sensitive_fields TEXT[] := ARRAY[
        'purchasePrice', 'purchaseDate', 'mortgageDetails',  -- Property
        'rentAmount', 'chargesAmount', 'depositAmount',      -- Unit
        'email', 'phone', 'idNumber', 'bankDetails', 'socialSecurityNumber', -- Tenant
        'rentAmount', 'depositAmount', 'terms',              -- Lease
        'amount', 'paymentMethod', 'transactionId', 'bankDetails', -- Payment
        'content', 'attachments',                            -- Message
        'debit', 'credit', 'account', 'description',        -- JournalEntry
        'email', 'phone', 'role', 'salary',                  -- User
        'stripeCustomerId', 'billingEmail', 'plan',          -- Organization
        'data', 'filters',                                   -- Report
        'details', 'metadata'                                -- Activity
    ];
    
    v_field_array TEXT[];
    v_is_sensitive BOOLEAN;
    v_access_level TEXT;
    v_can_create BOOLEAN;
    v_can_read BOOLEAN;
    v_can_edit BOOLEAN;
    v_can_delete BOOLEAN;
    v_can_view_all BOOLEAN;
    v_field_can_read BOOLEAN;
    v_field_can_edit BOOLEAN;
    v_field_access_level TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Loading All Permissions for All Profiles';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Loop through all active profiles (both global and organization-specific)
    FOR v_profile_record IN 
        SELECT id, name, organization_id, is_system_profile, display_name
        FROM profiles
        WHERE is_active = TRUE
        ORDER BY organization_id NULLS FIRST, name
    LOOP
        v_profile_id := v_profile_record.id;
        v_profile_name := v_profile_record.name;
        
        RAISE NOTICE 'Processing profile: % (ID: %, Org: %)', 
            v_profile_name, v_profile_id, v_profile_record.organization_id;
        
        -- ============================================================
        -- 1. LOAD OBJECT-LEVEL PERMISSIONS FOR ALL OBJECT TYPES
        -- ============================================================
        
        FOREACH v_object_type IN ARRAY v_object_types
        LOOP
            -- Determine permissions based on profile name
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                -- Full access for Admin profiles
                -- System Administrator has full access to Profile object for profile management
                IF v_object_type = 'Profile' AND v_profile_name = 'System Administrator' THEN
                    v_access_level := 'All';
                    v_can_create := TRUE;
                    v_can_read := TRUE;
                    v_can_edit := TRUE;
                    v_can_delete := TRUE;
                    v_can_view_all := TRUE;
                ELSIF v_object_type = 'Profile' AND v_profile_name IN ('Organization Administrator', 'Administrateur', 'Admin') THEN
                    -- Organization Administrator can manage profiles in their organization
                    v_access_level := 'All';
                    v_can_create := TRUE;
                    v_can_read := TRUE;
                    v_can_edit := TRUE;
                    v_can_delete := FALSE; -- Cannot delete system profiles
                    v_can_view_all := TRUE;
                ELSE
                    -- Full access for other objects
                    v_access_level := 'All';
                    v_can_create := TRUE;
                    v_can_read := TRUE;
                    v_can_edit := TRUE;
                    v_can_delete := TRUE;
                    v_can_view_all := TRUE;
                END IF;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                -- Accountant: Full access to financial objects, read-only for others
                IF v_object_type IN ('Payment', 'JournalEntry', 'Report', 'Activity') THEN
                    v_access_level := 'All';
                    v_can_create := TRUE;
                    v_can_read := TRUE;
                    v_can_edit := TRUE;
                    v_can_delete := TRUE;
                    v_can_view_all := TRUE;
                ELSIF v_object_type IN ('Property', 'Unit', 'Tenant', 'Lease') THEN
                    v_access_level := 'Read';
                    v_can_create := FALSE;
                    v_can_read := TRUE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := TRUE;
                ELSIF v_object_type = 'Profile' THEN
                    -- Accountant: No access to Profile management
                    v_access_level := 'None';
                    v_can_create := FALSE;
                    v_can_read := FALSE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := FALSE;
                ELSE
                    v_access_level := 'Read';
                    v_can_create := FALSE;
                    v_can_read := TRUE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := FALSE;
                END IF;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                -- Agent: Full access to operational objects (except delete), read-only for financial
                IF v_object_type IN ('Property', 'Unit', 'Tenant', 'Lease', 'Task', 'Message') THEN
                    v_access_level := 'ReadWrite';
                    v_can_create := TRUE;
                    v_can_read := TRUE;
                    v_can_edit := TRUE;
                    v_can_delete := FALSE;
                    v_can_view_all := TRUE;
                ELSIF v_object_type IN ('Payment', 'JournalEntry') THEN
                    v_access_level := 'Read';
                    v_can_create := FALSE;
                    v_can_read := TRUE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := TRUE;
                ELSIF v_object_type = 'Profile' THEN
                    -- Agent: No access to Profile management
                    v_access_level := 'None';
                    v_can_create := FALSE;
                    v_can_read := FALSE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := FALSE;
                ELSE
                    v_access_level := 'Read';
                    v_can_create := FALSE;
                    v_can_read := TRUE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := FALSE;
                END IF;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                -- Viewer: Read-only access to most objects, no access to Profile
                IF v_object_type = 'Profile' THEN
                    v_access_level := 'None';
                    v_can_create := FALSE;
                    v_can_read := FALSE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := FALSE;
                ELSE
                    v_access_level := 'Read';
                    v_can_create := FALSE;
                    v_can_read := TRUE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := TRUE;
                END IF;
            ELSE
                -- Default: Read-only access, no access to Profile
                IF v_object_type = 'Profile' THEN
                    v_access_level := 'None';
                    v_can_create := FALSE;
                    v_can_read := FALSE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := FALSE;
                ELSE
                    v_access_level := 'Read';
                    v_can_create := FALSE;
                    v_can_read := TRUE;
                    v_can_edit := FALSE;
                    v_can_delete := FALSE;
                    v_can_view_all := FALSE;
                END IF;
            END IF;
            
            -- Insert or update object-level permission
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
        END LOOP;
        
        RAISE NOTICE '  ✓ Object-level permissions loaded';
        
        -- ============================================================
        -- 2. LOAD FIELD-LEVEL PERMISSIONS FOR ALL OBJECT TYPES
        -- ============================================================
        
        -- Property fields
        FOREACH v_field_name IN ARRAY v_property_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            -- Determine field permissions based on profile
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'ReadWrite';
                    v_field_can_read := TRUE;
                    v_field_can_edit := TRUE;
                END IF;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                -- Default: Read-only
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
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
                v_field_access_level,
                v_field_can_read,
                v_field_can_edit,
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
        FOREACH v_field_name IN ARRAY v_unit_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'ReadWrite';
                    v_field_can_read := TRUE;
                    v_field_can_edit := TRUE;
                END IF;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Unit', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Tenant fields
        FOREACH v_field_name IN ARRAY v_tenant_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'ReadWrite';
                    v_field_can_read := TRUE;
                    v_field_can_edit := TRUE;
                END IF;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Tenant', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Lease fields
        FOREACH v_field_name IN ARRAY v_lease_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'ReadWrite';
                    v_field_can_read := TRUE;
                    v_field_can_edit := TRUE;
                END IF;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Lease', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Payment fields
        FOREACH v_field_name IN ARRAY v_payment_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Payment', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Task fields
        FOREACH v_field_name IN ARRAY v_task_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Task', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Message fields
        FOREACH v_field_name IN ARRAY v_message_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Message', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- JournalEntry fields
        FOREACH v_field_name IN ARRAY v_journal_entry_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'JournalEntry', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- User fields
        FOREACH v_field_name IN ARRAY v_user_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'User', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Organization fields
        FOREACH v_field_name IN ARRAY v_organization_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Organization', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Profile fields (only for System Administrator and Organization Administrator)
        IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Administrateur', 'Admin') THEN
            FOREACH v_field_name IN ARRAY v_profile_fields
            LOOP
                v_is_sensitive := v_field_name IN ('permissions', 'organization_id');
                
                IF v_profile_name = 'System Administrator' THEN
                    -- System Administrator: Full access to all profile fields
                    v_field_access_level := 'ReadWrite';
                    v_field_can_read := TRUE;
                    v_field_can_edit := TRUE;
                ELSIF v_profile_name IN ('Organization Administrator', 'Administrateur', 'Admin') THEN
                    -- Organization Administrator: Can manage profiles in their organization
                    IF v_field_name = 'is_system_profile' THEN
                        -- Cannot edit system profile flag
                        v_field_access_level := 'Read';
                        v_field_can_read := TRUE;
                        v_field_can_edit := FALSE;
                    ELSE
                        v_field_access_level := 'ReadWrite';
                        v_field_can_read := TRUE;
                        v_field_can_edit := TRUE;
                    END IF;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
                
                INSERT INTO profile_field_permissions (
                    profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
                ) VALUES (
                    v_profile_id, 'Profile', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
                )
                ON CONFLICT (profile_id, object_type, field_name)
                DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
            END LOOP;
        END IF;
        
        -- Report fields
        FOREACH v_field_name IN ARRAY v_report_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Report', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        -- Activity fields
        FOREACH v_field_name IN ARRAY v_activity_fields
        LOOP
            v_is_sensitive := v_field_name = ANY(v_sensitive_fields);
            
            IF v_profile_name IN ('System Administrator', 'Organization Administrator', 'Propriétaire', 'Owner', 'Administrateur', 'Admin') THEN
                v_field_access_level := 'ReadWrite';
                v_field_can_read := TRUE;
                v_field_can_edit := TRUE;
            ELSIF v_profile_name IN ('Comptable', 'Accountant') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Agent', 'Agent') THEN
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            ELSIF v_profile_name IN ('Lecteur', 'Viewer') THEN
                IF v_is_sensitive THEN
                    v_field_access_level := 'None';
                    v_field_can_read := FALSE;
                    v_field_can_edit := FALSE;
                ELSE
                    v_field_access_level := 'Read';
                    v_field_can_read := TRUE;
                    v_field_can_edit := FALSE;
                END IF;
            ELSE
                v_field_access_level := 'Read';
                v_field_can_read := TRUE;
                v_field_can_edit := FALSE;
            END IF;
            
            INSERT INTO profile_field_permissions (
                profile_id, object_type, field_name, access_level, can_read, can_edit, is_sensitive, created_at, updated_at
            ) VALUES (
                v_profile_id, 'Activity', v_field_name, v_field_access_level, v_field_can_read, v_field_can_edit, v_is_sensitive, NOW(), NOW()
            )
            ON CONFLICT (profile_id, object_type, field_name)
            DO UPDATE SET access_level = EXCLUDED.access_level, can_read = EXCLUDED.can_read, can_edit = EXCLUDED.can_edit, is_sensitive = EXCLUDED.is_sensitive, updated_at = NOW();
        END LOOP;
        
        RAISE NOTICE '  ✓ Field-level permissions loaded';
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Successfully loaded all permissions for all profiles';
    RAISE NOTICE '========================================';
END $$;

