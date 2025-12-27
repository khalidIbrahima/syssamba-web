# Security System Documentation

## Overview

The security system implements a hierarchical 4-level access control model:

1. **Plan Features Security** - What features are available based on subscription plan
2. **Profile Security** - What actions user can perform based on their profile
3. **Object Security** - What objects user can access (OLS - Object Level Security)
4. **Field Security** - What fields user can see/edit (FLS - Field Level Security) [Future]

## Architecture

```
┌─────────────────────────────────────────┐
│  Level 1: Plan Features Security      │
│  - Checks if feature is in plan       │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Level 2: Profile Security              │
│  - Checks profile permissions           │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Level 3: Object Security               │
│  - Checks object ownership/access       │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Level 4: Field Security (Future)      │
│  - Checks field-level permissions      │
└────────────────────────────────────────┘
```

## Usage

### Server-Side

```typescript
import { checkSecurity } from '@/lib/security/security-checker';

const result = await checkSecurity({
  planName: 'pro',
  profileId: 'profile-123',
  featureKey: 'properties_management',
  objectType: 'Property',
  objectId: 'property-456',
  action: 'edit',
});

if (result.allowed) {
  // User can edit this property
} else {
  console.log(result.reason); // Why access was denied
  console.log(result.failedLevel); // Which level failed
}
```

### Client-Side Hook

```typescript
import { useSecurity } from '@/hooks/use-security';

function MyComponent() {
  const { canAccessFeature, canPerformAction } = useSecurity();

  // Check feature access (Level 1 + 2)
  if (canAccessFeature('properties_management', 'Property', 'canEditProperties')) {
    // Show edit button
  }

  // Check action permission (Level 1 + 2)
  if (canPerformAction('Property', 'edit')) {
    // Allow editing
  }
}
```

### React Components

```typescript
import { FeatureGuard, ObjectGuard } from '@/components/security';

// Protect a feature
<FeatureGuard 
  featureKey="properties_management"
  objectType="Property"
  requiredPermission="canEditProperties"
  fallback={<div>Upgrade your plan to access this feature</div>}
>
  <EditPropertyButton />
</FeatureGuard>

// Protect an object action
<ObjectGuard 
  objectType="Property"
  action="edit"
  objectId={propertyId}
  fallback={<div>You don't have permission to edit this property</div>}
>
  <EditPropertyForm />
</ObjectGuard>
```

## API Route Protection

```typescript
import { checkSecurity } from '@/lib/security/security-checker';

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  const { propertyId } = await request.json();

  // Check security
  const result = await checkSecurity({
    planName: user.plan,
    profileId: user.profileId,
    featureKey: 'properties_management',
    objectType: 'Property',
    objectId: propertyId,
    action: 'edit',
  });

  if (!result.allowed) {
    return NextResponse.json(
      { error: result.reason },
      { status: 403 }
    );
  }

  // Proceed with update
}
```

## Security Levels Explained

### Level 1: Plan Features Security

Checks if a feature is enabled in the user's subscription plan. This is the first gate - if the plan doesn't include the feature, access is denied regardless of profile permissions.

**Example:**
- Plan `freemium` doesn't include `accounting_sycoda_full`
- Even if profile allows accounting access, user cannot access it

### Level 2: Profile Security

Checks if the user's profile allows a specific action on an object type. Profiles define base permissions (like Salesforce profiles).

**Example:**
- Profile `Agent` allows `read` and `edit` on `Property` but not `delete`
- User with this profile can view and edit properties but cannot delete them

### Level 3: Object Security

Checks if the user can access a specific object instance. This includes:
- Ownership checks (user created the object)
- Organization membership (object belongs to user's organization)
- Sharing rules (future)

**Example:**
- User can edit properties they created
- User cannot edit properties created by others (unless `canViewAll` is true)

### Level 4: Field Security (Future)

Checks if the user can read/edit specific fields on an object. This allows fine-grained control over sensitive data.

**Example:**
- Profile allows reading `Property` but not the `purchasePrice` field
- User can see property details but not the purchase price

## Best Practices

1. **Always check security server-side** - Client-side checks are for UI only
2. **Fail early** - Check plan features first, then profile, then object
3. **Log security failures** - Helps with debugging and auditing
4. **Use components for UI** - `FeatureGuard` and `ObjectGuard` simplify protection
5. **Cache security checks** - Use React Query with appropriate stale times

## Migration from Old System

The old system used role-based permissions. The new system uses:
- **Plans** instead of role-based feature checks
- **Profiles** instead of roles for permissions
- **Object-level checks** for instance access
- **Field-level checks** for sensitive data (future)

To migrate:
1. Replace `useRolePermissions` with `useSecurity`
2. Replace role checks with profile checks
3. Add plan feature checks where needed
4. Add object-level checks for instance access

