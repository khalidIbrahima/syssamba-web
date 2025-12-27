# Page Security Audit - Plan Features & Profile Access

## Overview
This document audits all pages to ensure they use proper security checks based on:
1. **Plan Features** - Features enabled/disabled per subscription plan
2. **Profile Permissions** - Object-level permissions based on user profiles

## Security Check Pattern

All pages should follow this pattern:
```typescript
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';

export default function MyPage() {
  // All hooks first (Rules of Hooks)
  const { canAccessFeature, canPerformAction, canAccessObject } = useAccess();
  const { data, isLoading } = useDataQuery(...);
  // ... other hooks
  
  // Security check AFTER all hooks
  if (!canAccessFeature('feature_key', 'permission')) {
    return <AccessDenied ... />;
  }
  
  // Rest of component
}
```

## Pages Audit

### ✅ Pages with Security Checks

#### Main Listing Pages
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

### ⚠️ Pages Needing Security Checks

#### Create Pages (New)
- ⚠️ `/properties/new` - **NEEDS CHECK**: Should verify `canAccessFeature('properties_management', 'canCreateProperties')`
- ⚠️ `/units/new` - **NEEDS CHECK**: Should verify `canAccessFeature('units_management', 'canCreateUnits')`
- ⚠️ `/tenants/new` - **NEEDS CHECK**: Should verify `canAccessFeature('tenants_basic', 'canCreateTenants')`
- ⚠️ `/tasks/new` - **NEEDS CHECK**: Should verify `canAccessFeature('basic_tasks', 'canCreateTasks')`
- ⚠️ `/leases/new` - **NEEDS CHECK**: Should verify `canAccessFeature('leases_basic', 'canCreateLeases')`

#### Edit Pages
- ⚠️ `/properties/[id]/edit` - **NEEDS CHECK**: Should verify `canAccessFeature('properties_management', 'canEditProperties')`
- ⚠️ `/units/[id]/edit` - **NEEDS CHECK**: Should verify `canAccessFeature('units_management', 'canEditUnits')`
- ⚠️ `/tenants/[id]/edit` - **NEEDS CHECK**: Should verify `canAccessFeature('tenants_basic', 'canEditTenants')`

#### Detail Pages
- ⚠️ `/properties/[id]` - **NEEDS CHECK**: Should verify `canAccessFeature('properties_management', 'canViewAllProperties')` or `canAccessObject('Property', 'read')`
- ⚠️ `/units/[id]` - **NEEDS CHECK**: Should verify `canAccessFeature('units_management', 'canViewAllUnits')` or `canAccessObject('Unit', 'read')`
- ⚠️ `/tenants/[id]` - **NEEDS CHECK**: Should verify `canAccessFeature('tenants_basic', 'canViewAllTenants')` or `canAccessObject('Tenant', 'read')`
- ⚠️ `/tasks/[id]` - **NEEDS CHECK**: Should verify `canAccessFeature('basic_tasks', 'canViewAllTasks')` or `canAccessObject('Task', 'read')`
- ⚠️ `/payments/[id]` - **NEEDS CHECK**: Should verify `canAccessFeature('payments_manual_entry', 'canViewAllPayments')` or `canAccessObject('Payment', 'read')`

#### Other Pages
- ⚠️ `/owners` - **NEEDS CHECK**: Should verify `canAccessFeature('properties_management', 'canViewAllProperties')` (owners are linked to properties)
- ⚠️ `/notifications` - **NEEDS CHECK**: Should verify `canAccessObject('Activity', 'read')` or `canAccessObject('Organization', 'read')`
- ⚠️ `/settings/subscription` - **NEEDS CHECK**: Should verify `canPerformAction('canViewSettings')` and possibly `canAccessObject('Organization', 'edit')`

#### Accounting Sub-pages
- ⚠️ `/accounting/dsf` - **NEEDS CHECK**: Should verify `canAccessFeature('accounting_sycoda_basic', 'canViewAccounting')`
- ⚠️ `/accounting/balance` - **NEEDS CHECK**: Should verify `canAccessFeature('accounting_sycoda_basic', 'canViewAccounting')`
- ⚠️ `/accounting/auto-entries` - **NEEDS CHECK**: Should verify `canAccessFeature('accounting_sycoda_basic', 'canViewAccounting')`

## Required Actions

### 1. Add Security Checks to Create Pages
All "new" pages should check if user can CREATE the object:
- Use `canAccessFeature('feature_key', 'canCreateObject')` 
- Or use `canAccessObject('ObjectType', 'create')`

### 2. Add Security Checks to Edit Pages
All "edit" pages should check if user can EDIT the object:
- Use `canAccessFeature('feature_key', 'canEditObject')`
- Or use `canAccessObject('ObjectType', 'edit')`
- Also verify user can access the specific record (ownership check if needed)

### 3. Add Security Checks to Detail Pages
All detail pages should check if user can READ the object:
- Use `canAccessFeature('feature_key', 'canViewAllObject')` 
- Or use `canAccessObject('ObjectType', 'read')`
- Consider record-level access (canViewAll vs own records)

### 4. Add Security Checks to Other Pages
- Owners page: Check property access
- Notifications page: Check activity/organization access
- Settings sub-pages: Check settings access

## Implementation Template

### For Create Pages
```typescript
'use client';

import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';

export default function NewObjectPage() {
  const { canAccessFeature, canAccessObject } = useAccess();
  // ... other hooks
  
  // Check CREATE permission
  if (!canAccessFeature('feature_key', 'canCreateObject') && 
      !canAccessObject('ObjectType', 'create')) {
    return (
      <AccessDenied
        featureName="Feature Name"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }
  
  // ... rest of component
}
```

### For Edit Pages
```typescript
'use client';

import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';

export default function EditObjectPage({ params }: { params: { id: string } }) {
  const { canAccessFeature, canAccessObject } = useAccess();
  // ... other hooks
  
  // Check EDIT permission
  if (!canAccessFeature('feature_key', 'canEditObject') && 
      !canAccessObject('ObjectType', 'edit')) {
    return (
      <AccessDenied
        featureName="Feature Name"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }
  
  // ... rest of component
}
```

### For Detail Pages
```typescript
'use client';

import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';

export default function ObjectDetailPage({ params }: { params: { id: string } }) {
  const { canAccessFeature, canAccessObject } = useAccess();
  // ... other hooks
  
  // Check READ permission
  if (!canAccessFeature('feature_key', 'canViewAllObject') && 
      !canAccessObject('ObjectType', 'read')) {
    return (
      <AccessDenied
        featureName="Feature Name"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }
  
  // ... rest of component
}
```

## Notes

- All security checks must be AFTER all hooks (Rules of Hooks)
- Use `canAccessFeature` for feature + permission checks
- Use `canAccessObject` as fallback for CRUD access
- Always show `AccessDenied` component when access is denied
- Consider record-level access for detail/edit pages (ownership)

