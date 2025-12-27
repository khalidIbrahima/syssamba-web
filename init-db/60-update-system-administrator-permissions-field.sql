-- =====================================================
-- Update System Administrator Permissions Field (JSONB)
-- This script updates the permissions JSONB field in the profiles table
-- System Administrator (Business Owner) has FULL access to ALL data within their organization
-- but RESPECTS PLAN LIMITATIONS for features - they can only use features enabled in their plan
-- =====================================================

DO $$
DECLARE
    v_admin_profile_id UUID;
    v_has_permissions BOOLEAN;
    v_all_permissions JSONB;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Updating System Administrator Permissions Field';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Check if permissions column exists
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'permissions'
    ) INTO v_has_permissions;
    
    IF NOT v_has_permissions THEN
        RAISE NOTICE 'Permissions column does not exist in profiles table. Skipping update.';
        RETURN;
    END IF;
    
    -- Find System Administrator profile (ONLY System Administrator, not Global Administrator)
    SELECT id INTO v_admin_profile_id
    FROM profiles
    WHERE name = 'System Administrator'
      AND is_system_profile = TRUE
    LIMIT 1;
    
    IF v_admin_profile_id IS NULL THEN
        RAISE EXCEPTION 'System Administrator profile not found. Please run init-db/56-create-missing-profiles.sql first.';
    END IF;
    
    RAISE NOTICE 'Found System Administrator profile: %', v_admin_profile_id;
    RAISE NOTICE '';
    
    -- Create comprehensive permissions JSONB object (respects plan limitations)
    v_all_permissions := '{
        "allAccess": false,
        "unlimited": true,
        "bypassSecurity": false,
        "objectPermissions": {
            "Property": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "Unit": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "Tenant": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "Lease": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "Payment": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "Task": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "Message": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "JournalEntry": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "User": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "Organization": {
                "accessLevel": "All",
                "canCreate": false,
                "canRead": true,
                "canEdit": true,
                "canDelete": false,
                "canViewAll": false
            },
            "Profile": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "Report": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            },
            "Activity": {
                "accessLevel": "All",
                "canCreate": true,
                "canRead": true,
                "canEdit": true,
                "canDelete": true,
                "canViewAll": true
            }
        },
        "fieldPermissions": {
            "allFields": {
                "accessLevel": "ReadWrite",
                "canRead": true,
                "canEdit": true
            }
        },
        "limits": {
            "lots": null,
            "users": null,
            "extranetTenants": null
        },
        "systemAdmin": true,
        "canManageAllOrganizations": false,
        "canManageAllUsers": true,
        "canManageAllProfiles": true,
        "canManageSystemSettings": true,
        "canBypassPlanLimits": true,
        "canAccessAllData": true
    }'::jsonb;
    
    -- Update the permissions field
    UPDATE profiles
    SET 
        permissions = v_all_permissions,
        updated_at = NOW()
    WHERE id = v_admin_profile_id;
    
    RAISE NOTICE '✓ Updated System Administrator permissions field';
    RAISE NOTICE '';
    RAISE NOTICE 'System Administrator (Business Owner) has FULL access within their organization:';
    RAISE NOTICE '  - allAccess: false (respects plan limitations)';
    RAISE NOTICE '  - unlimited: true (unlimited operations within org)';
    RAISE NOTICE '  - bypassSecurity: false (respects security rules)';
    RAISE NOTICE '  - Full object access: Property, Unit, Tenant, Lease, Payment, Task, Message, User, Profile, Report, Activity, JournalEntry';
    RAISE NOTICE '  - Organization management: Can edit their own organization settings (billing, features, etc.)';
    RAISE NOTICE '  - Cannot create/delete organizations or manage other organizations';
    RAISE NOTICE '  - Field permissions: ReadWrite for all fields';
    RAISE NOTICE '  - Features: Limited by organization plan (not all features enabled)';
    RAISE NOTICE '  - Complete business owner privileges within their organization plan limits';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'System Administrator Permissions Updated';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- Verify the update (ONLY System Administrator)
SELECT 
    id,
    name,
    display_name,
    permissions->>'allAccess' as all_access,
    permissions->>'systemAdmin' as system_admin,
    permissions->'objectPermissions'->'Property'->>'accessLevel' as property_access,
    permissions->'features'->>'dashboard' as dashboard_feature,
    updated_at
FROM profiles
WHERE name = 'System Administrator'
  AND is_system_profile = TRUE
LIMIT 1;

