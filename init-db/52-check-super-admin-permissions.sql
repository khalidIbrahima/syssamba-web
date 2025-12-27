-- =====================================================
-- Check Super Admin Permissions
-- This script checks if super admin users have access
-- to manage profiles and permissions
-- =====================================================

DO $$
DECLARE
    v_super_admin_user RECORD;
    v_profile_id UUID;
    v_org_permissions RECORD;
    v_user_permissions RECORD;
    v_has_org_access BOOLEAN := FALSE;
    v_has_user_access BOOLEAN := FALSE;
    v_profile_record RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking Super Admin Permissions';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Find all super admin users
    FOR v_super_admin_user IN 
        SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.organization_id, u.profile_id
        FROM users u
        WHERE u.is_super_admin = TRUE
        ORDER BY u.email
    LOOP
        RAISE NOTICE '--- Super Admin User ---';
        RAISE NOTICE 'ID: %', v_super_admin_user.id;
        RAISE NOTICE 'Email: %', v_super_admin_user.email;
        RAISE NOTICE 'Name: % %', v_super_admin_user.first_name, v_super_admin_user.last_name;
        RAISE NOTICE 'Organization ID: %', v_super_admin_user.organization_id;
        RAISE NOTICE 'Profile ID: %', v_super_admin_user.profile_id;
        RAISE NOTICE '';

        -- Check if user has a profile assigned
        IF v_super_admin_user.profile_id IS NULL THEN
            RAISE NOTICE '⚠️  WARNING: User has NO profile assigned!';
            RAISE NOTICE '   This means they cannot access profile/permission management via profile permissions.';
            RAISE NOTICE '';
        ELSE
            v_profile_id := v_super_admin_user.profile_id;
            
            -- Check Organization object permissions
            SELECT 
                access_level,
                can_create,
                can_read,
                can_edit,
                can_delete,
                can_view_all
            INTO v_org_permissions
            FROM profile_object_permissions
            WHERE profile_id = v_profile_id
              AND object_type = 'Organization'
            LIMIT 1;

            IF v_org_permissions IS NULL THEN
                RAISE NOTICE '⚠️  WARNING: No Organization permissions found for profile %', v_profile_id;
                v_has_org_access := FALSE;
            ELSE
                RAISE NOTICE 'Organization Permissions:';
                RAISE NOTICE '  - Access Level: %', v_org_permissions.access_level;
                RAISE NOTICE '  - Can Create: %', v_org_permissions.can_create;
                RAISE NOTICE '  - Can Read: %', v_org_permissions.can_read;
                RAISE NOTICE '  - Can Edit: %', v_org_permissions.can_edit;
                RAISE NOTICE '  - Can Delete: %', v_org_permissions.can_delete;
                RAISE NOTICE '  - Can View All: %', v_org_permissions.can_view_all;
                
                -- Check if user can edit Organization (required for profile management)
                v_has_org_access := v_org_permissions.can_edit = TRUE OR v_org_permissions.access_level = 'All';
                
                IF v_has_org_access THEN
                    RAISE NOTICE '✅ User CAN edit Organization (can manage profiles/permissions)';
                ELSE
                    RAISE NOTICE '❌ User CANNOT edit Organization (cannot manage profiles/permissions)';
                END IF;
                RAISE NOTICE '';
            END IF;

            -- Check User object permissions
            SELECT 
                access_level,
                can_create,
                can_read,
                can_edit,
                can_delete,
                can_view_all
            INTO v_user_permissions
            FROM profile_object_permissions
            WHERE profile_id = v_profile_id
              AND object_type = 'User'
            LIMIT 1;

            IF v_user_permissions IS NULL THEN
                RAISE NOTICE '⚠️  WARNING: No User permissions found for profile %', v_profile_id;
                v_has_user_access := FALSE;
            ELSE
                RAISE NOTICE 'User Permissions:';
                RAISE NOTICE '  - Access Level: %', v_user_permissions.access_level;
                RAISE NOTICE '  - Can Create: %', v_user_permissions.can_create;
                RAISE NOTICE '  - Can Read: %', v_user_permissions.can_read;
                RAISE NOTICE '  - Can Edit: %', v_user_permissions.can_edit;
                RAISE NOTICE '  - Can Delete: %', v_user_permissions.can_delete;
                RAISE NOTICE '  - Can View All: %', v_user_permissions.can_view_all;
                
                -- Check if user can edit User objects (also useful for profile management)
                v_has_user_access := v_user_permissions.can_edit = TRUE OR v_user_permissions.access_level = 'All';
                
                IF v_has_user_access THEN
                    RAISE NOTICE '✅ User CAN edit User objects';
                ELSE
                    RAISE NOTICE '❌ User CANNOT edit User objects';
                END IF;
                RAISE NOTICE '';
            END IF;

            -- Summary
            IF v_has_org_access OR v_has_user_access THEN
                RAISE NOTICE '✅ SUMMARY: User HAS access to manage profiles/permissions';
            ELSE
                RAISE NOTICE '❌ SUMMARY: User DOES NOT have access to manage profiles/permissions';
                RAISE NOTICE '   Recommendation: Assign a profile with Organization edit permissions';
            END IF;
        END IF;

        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
    END LOOP;

    -- Check if there are any super admin users
    IF NOT FOUND THEN
        RAISE NOTICE '⚠️  No super admin users found in the database!';
        RAISE NOTICE '   Check users.is_super_admin flag.';
    END IF;

    -- Show all profiles that have Organization edit access
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Profiles with Organization Edit Access';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    FOR v_profile_record IN
        SELECT 
            p.id,
            p.name,
            p.organization_id,
            p.is_system_profile,
            pop.access_level,
            pop.can_edit
        FROM profiles p
        JOIN profile_object_permissions pop ON p.id = pop.profile_id
        WHERE pop.object_type = 'Organization'
          AND (pop.can_edit = TRUE OR pop.access_level = 'All')
          AND p.is_active = TRUE
        ORDER BY p.organization_id NULLS FIRST, p.name
    LOOP
        RAISE NOTICE 'Profile: % (ID: %)', v_profile_record.name, v_profile_record.id;
        RAISE NOTICE '  Organization ID: %', v_profile_record.organization_id;
        RAISE NOTICE '  System Profile: %', v_profile_record.is_system_profile;
        RAISE NOTICE '  Access Level: %', v_profile_record.access_level;
        RAISE NOTICE '  Can Edit: %', v_profile_record.can_edit;
        RAISE NOTICE '';
    END LOOP;

END $$;

-- Show summary statistics
SELECT 
    'Super Admin Users' AS category,
    COUNT(DISTINCT u.id) AS count
FROM users u
WHERE u.is_super_admin = TRUE
   OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = u.id)
UNION ALL
SELECT 
    'Super Admins with Profile' AS category,
    COUNT(DISTINCT u.id) AS count
FROM users u
WHERE (u.is_super_admin = TRUE OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = u.id))
  AND u.profile_id IS NOT NULL
UNION ALL
SELECT 
    'Super Admins with Org Edit Access' AS category,
    COUNT(DISTINCT u.id) AS count
FROM users u
JOIN profile_object_permissions pop ON u.profile_id = pop.profile_id
WHERE (u.is_super_admin = TRUE OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = u.id))
  AND pop.object_type = 'Organization'
  AND (pop.can_edit = TRUE OR pop.access_level = 'All');

