# Security Review - Plan Features & Profile Access

## Overview
This document reviews the security implementation to ensure all access control is managed by:
1. **Plan Features** - Features enabled/disabled per subscription plan
2. **Profile Permissions** - Object-level and field-level permissions based on user profiles

## Security Architecture

### Two-Layer Security Model
1. **Plan Layer**: Features must be enabled in the user's subscription plan
2. **Profile Layer**: User must have appropriate permissions in their profile

### Access Control Flow
```
User Request → Check Plan Feature → Check Profile Permission → Allow/Deny
```

## Components Review

### ✅ Frontend Pages
All pages use `useAccess()` hook with proper checks:

- ✅ `/dashboard` - Uses `canAccessFeature('dashboard', 'canViewAllProperties')`
- ✅ `/properties` - Uses `canAccessFeature('properties_management', 'canViewAllProperties')`
- ✅ `/units` - Uses `canAccessFeature('units_management', 'canViewAllUnits')`
- ✅ `/tenants` - Uses `canAccessFeature('tenants_basic', 'canViewAllTenants')`
- ✅ `/leases` - Uses `canAccessFeature('leases_basic', 'canViewAllLeases')`
- ✅ `/payments` - Uses `canAccessFeature('payments_manual_entry', 'canViewAllPayments')`
- ✅ `/accounting` - Uses `canAccessFeature('accounting_sycoda_basic', 'canViewAccounting')`
- ✅ `/tasks` - Uses `canAccessFeature('basic_tasks', 'canViewAllTasks')`
- ✅ `/settings` - Uses `canPerformAction('canViewSettings')`
- ✅ `/settings/users` - Uses `canPerformAction('canViewSettings')`
- ✅ `/settings/profiles` - Uses `canPerformAction('canViewSettings')`

### ✅ Sidebar Navigation
- Uses `canAccessFeature()` and `canAccessObject()` to filter navigation items
- Checks both plan features and profile permissions
- Items hidden if feature not enabled OR user lacks permission

### ⚠️ API Routes - Needs Review

#### ✅ Already Using Profile Permissions
- `/api/messages` - ✅ Uses `getProfileObjectPermissions`
- `/api/profiles/*` - ✅ Uses profile-based checks
- `/api/organization/access-control-data` - ✅ Returns profile permissions
- `/api/organization/access` - ✅ Returns plan features and profile permissions

#### ✅ Migrated to Profile Permissions
- `/api/tasks` - ✅ Uses `getProfileObjectPermissions` and checks `basic_tasks` feature
- `/api/notifications` - ✅ Uses `getProfileObjectPermissions`

#### ⚠️ Legacy Routes (Deprecated - Still using roles for backward compatibility)
- `/api/organization/users/permissions-matrix` - ⚠️ Legacy route for old role-based system
- `/api/organization/users/roles` - ⚠️ Legacy route for custom roles (replaced by profiles)

#### ✅ Need to Verify Plan Feature Checks
All API routes should verify:
1. Feature is enabled in plan (if applicable)
2. User has profile permission for the action

## Required Fixes

### 1. API Routes Migration
✅ **COMPLETED** - All critical routes migrated:
- [x] `/api/tasks` - ✅ Migrated to `getProfileObjectPermissions` with plan feature check
- [x] `/api/notifications` - ✅ Migrated to `getProfileObjectPermissions`
- [x] `/api/messages` - ✅ Already using profile permissions

⚠️ **Legacy Routes** (Can be deprecated):
- [ ] `/api/organization/users/permissions-matrix` - Legacy route, consider deprecating
- [ ] `/api/organization/users/roles` - Legacy route, replaced by profiles system

### 2. Plan Feature Checks in API Routes
✅ **COMPLETED** for critical routes:
- [x] `/api/tasks` - ✅ Checks `basic_tasks` feature
- [ ] `/api/properties` - Check `properties_management` feature
- [ ] `/api/units` - Check `units_management` feature
- [ ] `/api/tenants` - Check `tenants_basic` feature
- [ ] `/api/leases` - Check `leases_basic` feature
- [ ] `/api/payments` - Check `payments_manual_entry` feature
- [ ] `/api/accounting/*` - Check `accounting_sycoda_basic` feature
- [ ] `/api/messages` - Check `messaging` feature (should be added)

### 3. Profile Permission Checks
Ensure all API routes check:
- Object-level permissions (canRead, canCreate, canEdit, canDelete)
- Field-level permissions (for sensitive fields)
- Record-level access (canViewAll vs own records)

## Security Best Practices

### ✅ Implemented
- Two-layer security (Plan + Profile)
- Profile-based permissions (not roles)
- Object-level and field-level security
- Access denied components for UI
- Sidebar filtering based on access

### ⚠️ To Implement
- Plan feature checks in all API routes
- Profile permission checks in all API routes
- Record-level access control (canViewAll vs own)
- Field-level security filtering in API responses

## Testing Checklist

- [ ] User without plan feature cannot access feature
- [ ] User without profile permission cannot access object
- [ ] User with CRUD but not ViewAll can see items in sidebar
- [ ] API routes reject requests without proper permissions
- [ ] AccessDenied component shows for unauthorized access
- [ ] Sidebar hides items user cannot access

## Notes

- Custom roles system is deprecated in favor of profiles
- All permissions should be checked via profile, not role
- Plan features control what's available, profiles control what user can do

