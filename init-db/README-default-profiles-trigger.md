# Default Profiles Trigger

This system automatically creates default profiles when a new organization is created.

## Files

- **`config/default-profiles.json`**: JSON configuration file defining which profiles should be created for each new organization
- **`57-create-default-profiles-trigger.sql`**: Creates the trigger, configuration table, and functions
- **`58-load-default-profiles-config-from-json.sql`**: Loads the JSON configuration into the database

## How It Works

1. **Configuration Table**: The `default_profiles_config` table stores the list of profiles to create for each new organization
2. **Trigger**: When a new organization is inserted into the `organizations` table, the trigger automatically calls `create_default_profiles_for_organization()`
3. **Function**: The function reads from the configuration table and creates each profile for the new organization

## Setup

1. Run the trigger creation script:
   ```sql
   \i init-db/57-create-default-profiles-trigger.sql
   ```

2. Load the configuration from JSON:
   ```sql
   \i init-db/58-load-default-profiles-config-from-json.sql
   ```

## Modifying Default Profiles

### Option 1: Update the Configuration Table Directly

```sql
-- Add a new default profile
INSERT INTO default_profiles_config (name, display_name, description, is_system_profile, is_active)
VALUES ('Manager', 'Gestionnaire', 'Profil gestionnaire', TRUE, TRUE);

-- Update an existing profile
UPDATE default_profiles_config
SET description = 'New description'
WHERE name = 'Owner';

-- Disable a profile (it won't be created for new organizations)
UPDATE default_profiles_config
SET is_active = FALSE
WHERE name = 'Viewer';
```

### Option 2: Update the JSON File and Reload

1. Edit `init-db/config/default-profiles.json`
2. Run `58-load-default-profiles-config-from-json.sql` again

## Manual Profile Creation

To manually create default profiles for an existing organization:

```sql
SELECT create_default_profiles_for_organization('your-organization-id-here');
```

## Default Profiles

The following profiles are created by default for each new organization:

1. **Owner** - Access to owned properties
2. **Accountant** - Access to financial and accounting data
3. **Agent** - Operational access for managing properties and tenants
4. **Viewer** - Read-only access

**Note**: The **System Administrator** profile is a global profile (not organization-specific) and is not created per organization. Users who create organizations are assigned the global System Administrator profile.

## System Administrator Access (Business Owner)

The **System Administrator** profile acts as a **business owner** with **COMPLETE CONTROL** over their organization's data and settings, but **RESPECTS PLAN LIMITATIONS**. This includes:

- **Full Access Objects**: Property, Unit, Tenant, Lease, Payment, Task, Message, JournalEntry, Profile, Report, Activity (within their org)
- **Organization Management**: Can edit their organization's settings, billing, features, and configuration
- **User Management**: Full access to User object (can create, edit, delete users within their organization)
- **Profile Management**: Full access to Profile object (can manage profile assignments within their organization)
- **Financial Data**: Complete access to payments, accounting, and all financial information (if enabled in plan)
- **Plan Limitations**: Can only access features enabled in their organization's subscription plan
- **Restrictions**: Cannot create/delete organizations or manage other organizations
- **All Actions**: Create, Read, Edit, Delete, View All within their organization (subject to plan features)
- **All Fields**: ReadWrite access to all fields in their organization's data (subject to plan features)

To verify System Administrator has all permissions, run:
```sql
\i init-db/59-verify-system-administrator-permissions.sql
```

To grant/update full access to System Administrator (object and field permissions), run:
```sql
\i init-db/55-grant-full-access-to-system-administrator.sql
```

To update the `permissions` JSONB field with comprehensive access configuration, run:
```sql
\i init-db/60-update-system-administrator-permissions-field.sql
```

**Note**: The `permissions` JSONB field stores additional permission metadata and can be used by the application for quick permission checks. The main permissions are stored in `profile_object_permissions` and `profile_field_permissions` tables.

## Global Administrator vs System Administrator

| Feature | System Administrator (Business Owner) | Global Administrator (SaaS Owner) |
|---------|--------------------------------------|----------------------------------|
| **Role Type** | Organization member | SaaS platform member |
| **Scope** | Single organization (their own) | All organizations |
| **Organization Management** | ✅ Can edit their org settings/billing | ✅ Full access (create/edit/delete all orgs) |
| **User Management** | ✅ Within their organization only | ✅ All users across all organizations |
| **Profile Management** | ✅ Within their organization only | ✅ All profiles across all organizations |
| **Accounting Access** | ✅ Full access (if in plan) | ✅ Full access to all orgs data |
| **Payment Access** | ✅ Full access (if in plan) | ✅ Full access to all orgs data |
| **Billing Data Access** | ✅ Can manage their org billing | ✅ Can manage all orgs billing |
| **Sensitive Data Access** | ✅ Full access (if in plan) | ✅ Full access to all orgs data |
| **System Settings** | ❌ No access to global settings | ✅ Full access to platform settings |
| **Plan Limits** | ❌ Respects plan limitations | ✅ Can bypass globally |
| **Business Focus** | 🏢 Run their business | 🌐 Manage the platform |

## Global Administrator Access (SaaS Platform Owner)

The **Global Administrator** profile belongs to **SaaS platform members** and has **COMPLETE AND UNRESTRICTED ACCESS** to ALL data and operations across the entire platform. This includes:

- **All Organizations**: Can create, edit, delete, and manage all organizations
- **All Users**: Can manage users across all organizations
- **All Profiles**: Can manage profiles and permissions globally
- **All Financial Data**: Complete access to payments, accounting, and billing information across all orgs
- **All Sensitive Data**: Access to all personal and financial data across all orgs
- **Platform Administration**: Can modify system settings, features, and platform configurations
- **No Restrictions**: Bypasses all security restrictions and plan limits
- **Cross-Organization**: Can view and manage data across all customer organizations

To restore Global Administrator permissions (with full access to everything), run:
```sql
\i init-db/61-restore-global-administrator-permissions.sql
```

**Warning**: Global Administrator has unrestricted access to all data across all organizations. This role should be assigned with extreme caution and only to trusted SaaS platform administrators.

## Notes

- Profiles are created as organization-specific (not global)
- Profiles are marked as system profiles (cannot be deleted)
- The trigger only runs on INSERT, not UPDATE
- If a profile with the same name already exists for the organization, it will be skipped

