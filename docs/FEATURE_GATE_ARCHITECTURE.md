# Feature Gate Architecture - Rebuilt

## Overview

The Feature Gate system has been completely rebuilt from scratch with a focus on:
- **Performance**: O(1) lookups using Map data structures
- **Reliability**: Automatic schema detection (handles both `key`/`feature_key` and `name`/`feature_name`)
- **Developer Experience**: Clean, intuitive API with TypeScript support
- **User Experience**: Better loading states, error handling, and upgrade prompts

## Architecture

### 1. API Layer (`/api/user/plan-features`)

**Automatic Schema Detection**
- Tries `features.name` + `plan_features.feature_name` first (actual schema)
- Falls back to `features.key` + `plan_features.feature_key` (migration schema)
- No manual configuration needed

**Response Format**
```typescript
{
  plan: {
    id: string;
    name: string;
    displayName: string;
    description: string | null;
  },
  features: [
    {
      id: string;
      featureKey: string;        // e.g., "task_management"
      displayName: string;       // e.g., "Gestion des tâches"
      description: string | null;
      category: string;
      isEnabled: boolean;
      limits?: Record<string, any>;
    }
  ]
}
```

### 2. Context Layer (`FeatureContext`)

**Features**
- Global state management via React Context
- Memoized Map for O(1) feature lookups
- Automatic caching (5 min stale time, 10 min GC time)
- Error handling and loading states

**API**
```typescript
const {
  plan,                    // Current user's plan
  features,               // All features array
  hasFeature,            // Check if feature exists
  isFeatureEnabled,      // Check if feature is enabled
  getFeature,            // Get full feature object
  getFeatureLimit,       // Get specific limit value
  getFeaturesByCategory, // Get features by category
  getAllEnabledFeatures, // Get all enabled features
  isLoading,
  error,
} = useFeatures();
```

### 3. Component Layer (`FeatureGate`)

**Components**

#### `FeatureGate`
Main component for conditional rendering.

```tsx
<FeatureGate 
  feature="task_management"
  showUpgrade={true}
  upgradeHref="/pricing"
>
  <TasksPage />
</FeatureGate>
```

**Props:**
- `feature`: Feature key (required)
- `children`: Content to render if enabled
- `fallback`: Custom fallback component
- `showUpgrade`: Show upgrade prompt if disabled
- `upgradeHref`: Link for upgrade button (default: `/pricing`)
- `loadingComponent`: Custom loading component
- `errorComponent`: Custom error component

#### `FeatureToggle`
Show different content based on feature state.

```tsx
<FeatureToggle
  feature="advanced_analytics"
  enabled={<AdvancedCharts />}
  disabled={<BasicCharts />}
/>
```

#### `FeatureLimit`
Access feature limits via render prop.

```tsx
<FeatureLimit feature="property_management" limitKey="max_properties">
  {(maxProperties) => (
    <p>Vous pouvez créer jusqu'à {maxProperties ?? 'illimité'} propriétés</p>
  )}
</FeatureLimit>
```

#### `RequireFeature`
Multiple features with AND/OR logic.

```tsx
<RequireFeature 
  features={["advanced_analytics", "api_access"]} 
  requireAll={true}
>
  <ApiAnalyticsDashboard />
</RequireFeature>
```

#### `FeatureBadge`
Visual indicator for feature availability.

```tsx
<FeatureBadge feature="premium_feature" />
```

## Usage Examples

### Basic Feature Check
```tsx
import { FeatureGate } from '@/components/features/FeatureGate';

export default function TasksPage() {
  return (
    <FeatureGate feature="task_management" showUpgrade>
      <div>Tasks content here</div>
    </FeatureGate>
  );
}
```

### Using Hook
```tsx
import { useFeatures } from '@/contexts/FeatureContext';

export default function MyComponent() {
  const { isFeatureEnabled, getFeatureLimit } = useFeatures();
  
  const canUseAdvancedFeatures = isFeatureEnabled('advanced_analytics');
  const maxProperties = getFeatureLimit('property_management', 'max_properties');
  
  return (
    <div>
      {canUseAdvancedFeatures && <AdvancedFeatures />}
      <p>Max properties: {maxProperties ?? 'unlimited'}</p>
    </div>
  );
}
```

### Custom Fallback
```tsx
<FeatureGate 
  feature="premium_feature"
  fallback={<CustomUpgradePrompt />}
>
  <PremiumContent />
</FeatureGate>
```

### Multiple Features (AND)
```tsx
<RequireFeature 
  features={["feature_a", "feature_b"]} 
  requireAll={true}
>
  <ContentRequiringBothFeatures />
</RequireFeature>
```

### Multiple Features (OR)
```tsx
<RequireFeature 
  features={["feature_a", "feature_b"]} 
  requireAll={false}
>
  <ContentRequiringEitherFeature />
</RequireFeature>
```

## Performance Optimizations

1. **Memoized Maps**: Feature lookups are O(1) instead of O(n)
2. **Query Caching**: Features are cached for 5 minutes
3. **Automatic Refetching**: Only refetches when cache is stale
4. **Lazy Loading**: Features are only fetched when `FeatureProvider` is mounted

## Error Handling

The system handles errors gracefully:
- **API Errors**: Shows user-friendly error message
- **Missing Features**: Returns `false` for `isFeatureEnabled()`
- **Network Issues**: Retries automatically (via React Query)
- **Schema Mismatches**: Automatically detects and handles both schemas

## Migration from Old System

The new system is backward compatible. Existing code should work without changes:

```tsx
// Old (still works)
<FeatureGate feature="task_management">
  <TasksPage />
</FeatureGate>

// New (recommended)
<FeatureGate feature="task_management" showUpgrade>
  <TasksPage />
</FeatureGate>
```

## Best Practices

1. **Always use `featureKey`**: Use the unique identifier (e.g., `"task_management"`)
2. **Provide fallbacks**: Use `fallback` prop for better UX
3. **Show upgrade prompts**: Use `showUpgrade` for premium features
4. **Check before rendering**: Use `useFeature` hook for conditional logic
5. **Cache limits**: Don't call `getFeatureLimit` in render loops

## Database Schema

The system supports two schemas automatically:

**Schema A (Migration):**
- `features.key` (unique identifier)
- `plan_features.feature_key` (references `features.key`)

**Schema B (Actual):**
- `features.name` (unique identifier)
- `plan_features.feature_name` (references `features.name`)

The API automatically detects which schema is in use and adapts accordingly.

