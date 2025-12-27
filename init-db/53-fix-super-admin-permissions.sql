-- =====================================================
-- Fix Super Admin Permissions
-- This script ensures super admin users have full access
-- to manage profiles and permissions
-- =====================================================

DO $$
DECLARE
    v_super_admin_user RECORD;
    v_profile_id UUID;
    v_admin_profile_id UUID;
    v_org_permission_exists BOOLEAN;
    v_user_permission_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Fixing Super Admin Permissions';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Find or create an admin profile with full permissions
    -- First, try to find "Organization Administrator" profile
    SELECT id INTO v_admin_profile_id
    FROM profiles
    WHERE name = 'Organization Administrator'
      AND is_active = TRUE
    ORDER BY organization_id NULLS FIRST
    LIMIT 1;

    -- If not found, try "Administrateur" or "Admin"
    IF v_admin_profile_id IS NULL THEN
        SELECT id INTO v_admin_profile_id
        FROM profiles
        WHERE name IN ('Administrateur', 'Admin', 'Administrator')
          AND is_active = TRUE
        ORDER BY organization_id NULLS FIRST
        LIMIT 1;
    END IF;

    -- If still not found, create a global admin profile
    IF v_admin_profile_id IS NULL THEN
        -- Check which columns exist in profiles table
        DECLARE
            v_has_display_name BOOLEAN;
            v_has_permissions BOOLEAN;
            v_has_is_global BOOLEAN;
        BEGIN
            -- Check for display_name column (required based on error)
            SELECT EXISTS(
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'profiles' 
                AND column_name = 'display_name'
            ) INTO v_has_display_name;
            
            -- Check for permissions JSONB column (seen in error as {})
            SELECT EXISTS(
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'profiles' 
                AND column_name = 'permissions'
            ) INTO v_has_permissions;
            
            -- Check for is_global column
            SELECT EXISTS(
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'profiles' 
                AND column_name = 'is_global'
            ) INTO v_has_is_global;
            
            -- Build INSERT statement based on existing columns
            -- display_name is required (NOT NULL constraint)
            IF v_has_display_name AND v_has_permissions AND v_has_is_global THEN
                -- Full schema: display_name, permissions, is_global
                INSERT INTO profiles (
                    name,
                    display_name,
                    description,
                    organization_id,
                    is_system_profile,
                    is_global,
                    is_active,
                    permissions,
                    created_at,
                    updated_at
                ) VALUES (
                    'System Administrator',
                    'System Administrator',
                    'Global system administrator profile with full access',
                    NULL,
                    TRUE,
                    TRUE,
                    TRUE,
                    '{}'::jsonb,
                    NOW(),
                    NOW()
                ) RETURNING id INTO v_admin_profile_id;
            ELSIF v_has_display_name AND v_has_permissions THEN
                -- display_name and permissions, no is_global
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
                    'Global system administrator profile with full access',
                    NULL,
                    TRUE,
                    TRUE,
                    '{}'::jsonb,
                    NOW(),
                    NOW()
                ) RETURNING id INTO v_admin_profile_id;
            ELSIF v_has_display_name THEN
                -- Only display_name (required)
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
                    'Global system administrator profile with full access',
                    NULL,
                    TRUE,
                    TRUE,
                    NOW(),
                    NOW()
                ) RETURNING id INTO v_admin_profile_id;
            ELSE
                -- Fallback: try without display_name (should not happen if error says it's required)
                RAISE EXCEPTION 'display_name column is required but not found in profiles table';
            END IF;
        END;
        
        RAISE NOTICE 'Created new System Administrator profile: %', v_admin_profile_id;
    ELSE
        RAISE NOTICE 'Found existing admin profile: %', v_admin_profile_id;
    END IF;

    -- Ensure the admin profile has full Organization permissions
    SELECT EXISTS(
        SELECT 1 FROM profile_object_permissions
        WHERE profile_id = v_admin_profile_id
          AND object_type = 'Organization'
    ) INTO v_org_permission_exists;

    IF NOT v_org_permission_exists THEN
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
            'Organization',
            'All',
            TRUE,
            TRUE,
            TRUE,
            TRUE,
            TRUE,
            NOW(),
            NOW()
        );
        RAISE NOTICE 'Added Organization permissions to admin profile';
    ELSE
        -- Update existing permissions to ensure full access
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
          AND object_type = 'Organization';
        RAISE NOTICE 'Updated Organization permissions for admin profile';
    END IF;

    -- Ensure the admin profile has full User permissions
    SELECT EXISTS(
        SELECT 1 FROM profile_object_permissions
        WHERE profile_id = v_admin_profile_id
          AND object_type = 'User'
    ) INTO v_user_permission_exists;

    IF NOT v_user_permission_exists THEN
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
            'User',
            'All',
            TRUE,
            TRUE,
            TRUE,
            TRUE,
            TRUE,
            NOW(),
            NOW()
        );
        RAISE NOTICE 'Added User permissions to admin profile';
    ELSE
        -- Update existing permissions to ensure full access
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
          AND object_type = 'User';
        RAISE NOTICE 'Updated User permissions for admin profile';
    END IF;

    -- Assign this profile to all super admin users who don't have a profile
    FOR v_super_admin_user IN 
        SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
        FROM users u
        WHERE u.is_super_admin = TRUE
          AND (u.profile_id IS NULL OR u.profile_id != v_admin_profile_id)
        ORDER BY u.email
    LOOP
        RAISE NOTICE 'Assigning admin profile to super admin: % (%)', 
            v_super_admin_user.email, v_super_admin_user.id;
        
        UPDATE users
        SET profile_id = v_admin_profile_id
        WHERE id = v_super_admin_user.id;
        
        RAISE NOTICE '  ✅ Profile assigned';
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Summary';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Admin Profile ID: %', v_admin_profile_id;
    RAISE NOTICE 'Super admins updated: %', (
        SELECT COUNT(*)
        FROM users
        WHERE (is_super_admin = TRUE OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = users.id))
          AND profile_id = v_admin_profile_id
    );
    RAISE NOTICE '';
    RAISE NOTICE '✅ Super admin permissions have been fixed!';
    RAISE NOTICE '';

END $$;

-- Verify the fix
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.profile_id,
    p.name AS profile_name,
    pop.object_type,
    pop.access_level,
    pop.can_edit
FROM users u
LEFT JOIN profiles p ON u.profile_id = p.id
LEFT JOIN profile_object_permissions pop ON u.profile_id = pop.profile_id AND pop.object_type = 'Organization'
WHERE (u.is_super_admin = TRUE OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = u.id))
ORDER BY u.email;

