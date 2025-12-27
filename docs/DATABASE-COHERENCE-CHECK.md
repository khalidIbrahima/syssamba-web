# Database Coherence Check - Plan Features & Profiles

## Overview
This document describes the verification and correction script that ensures coherence between:
1. **Plan Features** - Features enabled/disabled per subscription plan
2. **Profile Permissions** - Object-level permissions for user profiles

## Script: `init-db/43-verify-and-fix-plan-features-profiles.sql`

### What It Does

#### 1. Messaging Feature Verification
- ✅ Ensures `messaging` feature exists in `features` table
- ✅ Enables `messaging` for all plans in `plan_features` table
- ✅ Updates existing entries if needed

#### 2. Required Features Verification
Verifies that all required features are enabled for each plan:
- `dashboard` - Core feature
- `properties_management` - Core feature
- `units_management` - Core feature
- `tenants_basic` - Basic tenant management
- `leases_basic` - Basic lease management
- `payments_manual_entry` - Payment entry
- `basic_tasks` - Task management
- `messaging` - Messaging system

If any feature is missing for a plan, it's automatically added.

#### 3. Default Profiles Creation
For each organization, ensures these default profiles exist:
- **Propriétaire** (Owner) - Full access to everything
- **Administrateur** (Admin) - Full access to everything
- **Comptable** (Accountant) - Read/Write access to financial data (Payment, JournalEntry)
- **Agent** (Agent) - Read/Write access to operational data (Property, Unit, Tenant, Lease, Task, Message)
- **Lecteur** (Viewer) - Read-only access

If profiles are missing, they are created with appropriate permissions.

#### 4. Profile Permissions Setup
When creating default profiles, sets object-level permissions:

**Owner & Admin:**
- All objects: `canCreate`, `canRead`, `canEdit`, `canDelete`, `canViewAll` = TRUE

**Accountant:**
- Payment, JournalEntry: `canCreate`, `canRead`, `canEdit` = TRUE
- Other objects: `canRead` = TRUE only

**Agent:**
- Property, Unit, Tenant, Lease, Task, Message: `canCreate`, `canRead`, `canEdit` = TRUE
- Payment: `canRead` = TRUE only
- Other objects: `canRead` = TRUE only

**Viewer:**
- All objects: `canRead` = FALSE (no access by default, can be granted)

#### 5. User Profile Assignment
Assigns profiles to users who don't have one, based on their legacy `role`:
- `role = 'owner'` → `Propriétaire` profile
- `role = 'admin'` → `Administrateur` profile
- `role = 'accountant'` → `Comptable` profile
- `role = 'agent'` → `Agent` profile
- `role = 'viewer'` or other → `Lecteur` profile

## How to Run

### On Supabase
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `init-db/43-verify-and-fix-plan-features-profiles.sql`
3. Execute the script
4. Check the output for verification messages

### Expected Output
```
========================================
Starting Plan Features & Profiles Verification
========================================

1. Checking messaging feature...
  ✓ Messaging enabled for plan: freemium
  ✓ Messaging enabled for plan: starter
  ✓ Messaging enabled for plan: pro
  ✓ Messaging enabled for plan: agency
  ✓ Messaging enabled for plan: enterprise

2. Verifying required features for each plan...
  ✓ Plan freemium has all required features
  ✓ Plan starter has all required features
  ...

3. Verifying default profiles for each organization...
  ✓ Organization [name] has all default profiles
  ...

4. Assigning profiles to users without profiles...
  ✓ Assigned profiles to X users in organization [id]
  ...

========================================
Verification Complete
========================================
```

## Verification Queries

After running the script, you can verify the results:

### Check Plan Features
```sql
SELECT 
    p.name as plan_name,
    COUNT(pf.feature_key) as enabled_features
FROM plans p
LEFT JOIN plan_features pf ON p.name = pf.plan_name AND pf.is_enabled = TRUE
GROUP BY p.name
ORDER BY p.name;
```

### Check Profiles per Organization
```sql
SELECT 
    o.name as organization_name,
    COUNT(p.id) as profile_count
FROM organizations o
LEFT JOIN profiles p ON o.id = p.organization_id
GROUP BY o.id, o.name
ORDER BY o.name;
```

### Check Users Without Profiles
```sql
SELECT 
    u.id,
    u.email,
    u.role,
    o.name as organization_name
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE u.profile_id IS NULL;
```

### Check Profile Permissions
```sql
SELECT 
    p.name as profile_name,
    o.name as organization_name,
    pop.object_type,
    pop.can_create,
    pop.can_read,
    pop.can_edit,
    pop.can_delete,
    pop.can_view_all
FROM profile_object_permissions pop
JOIN profiles p ON pop.profile_id = p.id
LEFT JOIN organizations o ON p.organization_id = o.id
ORDER BY o.name, p.name, pop.object_type;
```

## Notes

- The script is **idempotent** - it can be run multiple times safely
- It uses `ON CONFLICT` clauses to update existing data rather than failing
- All changes are logged via `RAISE NOTICE` statements
- The script creates organization-specific profiles (not global)
- Profile permissions are set based on the profile type's intended use

## Next Steps

After running the script:
1. Review profile permissions in `/settings/profiles` for each organization
2. Adjust permissions as needed for your use case
3. Verify plan features in `/settings/subscription`
4. Test access control with different user profiles

