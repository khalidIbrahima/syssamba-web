-- =====================================================
-- Migration: Disable Organization-Specific Profiles Trigger
-- We now use existing global system profiles instead of creating
-- organization-specific profiles for each new organization
-- =====================================================

-- Drop the trigger that creates organization-specific profiles
DROP TRIGGER IF EXISTS trg_create_default_profiles ON organizations;

-- Note: The function create_default_profiles_for_organization is kept
-- in case it's needed for manual operations, but the trigger is disabled

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Organization Profiles Trigger Disabled';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'The trigger that creates organization-specific profiles has been disabled.';
    RAISE NOTICE 'We now use existing global system profiles (is_global = TRUE) instead.';
    RAISE NOTICE '';
    RAISE NOTICE 'Global profiles available:';
    RAISE NOTICE '  - System Administrator (for new signups)';
    RAISE NOTICE '  - Propriétaire (Owner)';
    RAISE NOTICE '  - Administrateur (Admin)';
    RAISE NOTICE '  - Comptable (Accountant)';
    RAISE NOTICE '  - Agent';
    RAISE NOTICE '  - Lecteur (Viewer)';
    RAISE NOTICE '';
    RAISE NOTICE 'These profiles are shared across all organizations.';
    RAISE NOTICE '';
END $$;

