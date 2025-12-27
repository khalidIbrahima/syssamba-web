# Plan Features Integration

## Overview

The system uses the `plan_features` table to control feature visibility based on the user's current subscription plan. This ensures that users only see features that are available in their plan.

## Data Flow

```
plan_features table (Supabase)
    ↓
getEnabledPlanFeatures() in plan-features.ts
    ↓
/api/organization/access API route
    ↓
useAccess() hook
    ↓
UI Components (Sidebar, FeatureGuard, etc.)
```

## How It Works

### 1. Database Structure

The `plan_features` table stores which features are enabled for each plan:

```sql
plan_features
  - plan_id (UUID) → references plans.id
  - feature_id (UUID) → references features.id
  - is_enabled (boolean)
  - limits (JSONB, optional)
```

The `features` table stores feature definitions:

```sql
features
  - id (UUID)
  - name (string) → feature key (e.g., "properties_management")
  - display_name (string)
  - category (string)
  - is_active (boolean)
```

### 2. Reading Features

**Server-side:**
```typescript
import { getEnabledPlanFeatures } from '@/lib/plan-features';

// Get all enabled features for a plan
const enabledFeatures = await getEnabledPlanFeatures('pro');
// Returns: Set<string> of feature keys

// Check if a specific feature is enabled
const hasFeature = enabledFeatures.has('properties_management');
```

**Client-side:**
```typescript
import { useAccess } from '@/hooks/use-access';

function MyComponent() {
  const { hasFeature, canAccessFeature } = useAccess();
  
  // Check if feature is enabled in plan
  if (hasFeature('properties_management')) {
    // Show feature
  }
}
```

### 3. API Route

The `/api/organization/access` route reads features from `plan_features`:

```typescript
// src/app/api/organization/access/route.ts
const enabledFeatures = await getEnabledPlanFeatures(planName);
return NextResponse.json({
  planName,
  enabledFeatures: Array.from(enabledFeatures),
});
```

### 4. UI Visibility

**Sidebar Navigation:**
```typescript
// src/components/layout/sidebar.tsx
const { hasFeature } = useAccess();

const filteredNavigation = navigationItems.filter((item) => {
  if (item.featureKey && !hasFeature(item.featureKey)) {
    return false; // Hide item if feature not enabled
  }
  return true;
});
```

**FeatureGuard Component:**
```typescript
import { FeatureGuard } from '@/components/security';

<FeatureGuard 
  featureKey="properties_management"
  fallback={<div>Upgrade to access this feature</div>}
>
  <PropertiesPage />
</FeatureGuard>
```

## Security Levels

The system implements 3 levels of security (4th level for fields is future):

1. **Plan Features Security** (Level 1) - Reads from `plan_features` table
   - Checks if feature is enabled in user's plan
   - Implemented in: `src/lib/security/plan-security.ts`
   - Uses: `getEnabledPlanFeatures()` from `plan-features.ts`

2. **Profile Security** (Level 2) - Reads from `profile_object_permissions` table
   - Checks if user's profile allows the action
   - Implemented in: `src/lib/security/profile-security.ts`

3. **Object Security** (Level 3) - Checks object ownership
   - Checks if user can access specific object instance
   - Implemented in: `src/lib/security/object-security.ts`

4. **Field Security** (Level 4) - Future implementation
   - Checks field-level permissions
   - Implemented in: `src/lib/security/field-security.ts`

## Key Functions

### `getEnabledPlanFeatures(planName: PlanName): Promise<Set<string>>`

Reads from `plan_features` table and returns a Set of enabled feature keys.

**Implementation:**
1. Gets `plan_id` from `plans` table using `planName`
2. Queries `plan_features` table for enabled features (`is_enabled = true`)
3. Joins with `features` table to get feature keys (`features.name`)
4. Returns Set of feature keys

**Location:** `src/lib/plan-features.ts`

### `checkPlanFeature(planName: PlanName, featureKey: string): Promise<boolean>`

Checks if a specific feature is enabled for a plan.

**Implementation:**
- Uses `getEnabledPlanFeatures()` and checks if feature key exists in Set

**Location:** `src/lib/security/plan-security.ts`

## Usage Examples

### Example 1: Hide Navigation Item

```typescript
// In sidebar.tsx
const { hasFeature } = useAccess();

{hasFeature('accounting_sycoda_full') && (
  <Link href="/accounting">Comptabilité</Link>
)}
```

### Example 2: Protect API Route

```typescript
// In API route
import { checkPlanFeature } from '@/lib/security/plan-security';

const hasFeature = await checkPlanFeature(planName, 'properties_management');
if (!hasFeature) {
  return NextResponse.json(
    { error: 'Feature not available in your plan' },
    { status: 403 }
  );
}
```

### Example 3: Conditional UI Rendering

```typescript
import { FeatureGuard } from '@/components/security';

<FeatureGuard 
  featureKey="electronic_signature"
  fallback={
    <Button onClick={() => router.push('/pricing')}>
      Upgrade to Pro
    </Button>
  }
>
  <ElectronicSignatureButton />
</FeatureGuard>
```

## Testing

To test feature visibility:

1. **Check database:**
   ```sql
   SELECT pf.*, f.name as feature_key, f.display_name
   FROM plan_features pf
   JOIN features f ON pf.feature_id = f.id
   WHERE pf.plan_id = (SELECT id FROM plans WHERE name = 'pro')
   AND pf.is_enabled = true;
   ```

2. **Check API response:**
   ```bash
   curl http://localhost:3000/api/organization/access
   # Should return: { "enabledFeatures": ["properties_management", ...] }
   ```

3. **Check in UI:**
   - Features should be hidden/shown based on plan
   - Navigation items should filter correctly
   - FeatureGuard should work as expected

## Adding New Features

1. **Add feature to `features` table:**
   ```sql
   INSERT INTO features (name, display_name, category, is_active)
   VALUES ('new_feature', 'New Feature', 'advanced', true);
   ```

2. **Enable feature for plans in `plan_features` table:**
   ```sql
   INSERT INTO plan_features (plan_id, feature_id, is_enabled)
   SELECT p.id, f.id, true
   FROM plans p, features f
   WHERE p.name = 'pro' AND f.name = 'new_feature';
   ```

3. **Use in code:**
   ```typescript
   const { hasFeature } = useAccess();
   if (hasFeature('new_feature')) {
     // Show feature
   }
   ```

## Notes

- Features are read from `plan_features` table, not from `plans.features` JSONB
- The `features.name` field is used as the feature key
- Feature keys should be consistent across the codebase (e.g., `properties_management`, `accounting_sycoda_full`)
- All feature checks go through the security system which combines plan, profile, and object security

