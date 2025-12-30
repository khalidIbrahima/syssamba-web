# Loading State Fix - Applied to All Pages

## Summary

Fixed the "access denied" flash issue across all pages by adding proper loading state checks.

## Changes Made

### New Files Created:
1. **`src/components/ui/page-loader.tsx`** - Reusable loading component
2. **`src/hooks/use-page-access.ts`** - Combined hook for access checks with loading states

### Pattern Applied to All Pages:

**Before:**
```typescript
export default function MyPage() {
  const { canAccessObject } = useAccess();
  
  // ❌ Immediate check - shows AccessDenied while loading
  if (!canAccessObject('Property', 'read')) {
    return <AccessDenied />;
  }
  
  return <PageContent />;
}
```

**After:**
```typescript
export default function MyPage() {
  const { canAccessObject, isLoading } = usePageAccess();
  
  // ✅ Check loading state first
  if (isLoading) {
    return <PageLoader />;
  }
  
  // Then check access
  if (!canAccessObject('Property', 'read')) {
    return <AccessDenied />;
  }
  
  return <PageContent />;
}
```

## Updated Components

### Core Hooks:
- `use-page-access.ts` - Combines `useAccess()` and `useSuperAdmin()` with unified loading state

### UI Components:
- `page-loader.tsx` - Standard loading component for pages
- `app-loader.tsx` - Enhanced with minimum load time (500ms) to prevent flash

### Pages Updated:
1. `/dashboard` - Dashboard page
2. `/admin` - Admin panel
3. `/properties` - Properties list
4. `/properties/[id]` - Property details
5. `/properties/new` - New property
6. `/units` - Units list
7. `/units/[id]` - Unit details
8. `/units/new` - New unit
9. `/tenants` - Tenants list
10. `/tenants/[id]` - Tenant details
11. `/tenants/new` - New tenant
12. `/leases` - Leases list
13. `/leases/new` - New lease
14. `/payments` - Payments list
15. `/payments/[id]` - Payment details
16. `/tasks` - Tasks kanban
17. `/tasks/[id]` - Task details
18. `/tasks/new` - New task
19. `/accounting` - Accounting dashboard
20. `/accounting/balance` - Balance sheet
21. `/accounting/dsf` - DSF reports
22. `/settings` - Settings page
23. `/settings/users` - Users management
24. `/settings/subscription` - Subscription
25. `/notifications` - Notifications
26. `/owners` - Owners list
27. `/admin/profiles` - Profiles management

## Benefits

✅ No more "access denied" flash on page load  
✅ Smooth loading transitions  
✅ Consistent UX across all pages  
✅ Minimum 500ms load time prevents jarring transitions  
✅ Data fully loaded before showing UI  
✅ Professional user experience  

## Usage in New Pages

When creating a new page with access checks:

```typescript
import { usePageAccess } from '@/hooks/use-page-access';
import { PageLoader } from '@/components/ui/page-loader';
import { AccessDenied } from '@/components/ui/access-denied';

export default function NewPage() {
  const { canAccessObject, isLoading } = usePageAccess();
  
  // Always check loading first
  if (isLoading) {
    return <PageLoader message="Chargement..." />;
  }
  
  // Then check permissions
  if (!canAccessObject('MyObject', 'read')) {
    return <AccessDenied featureName="My Feature" />;
  }
  
  return <div>Page Content</div>;
}
```

## Technical Details

### AppLoader Enhancement:
- Minimum load time: 500ms
- Prevents flash by ensuring loader shows long enough
- Waits for both data ready AND minimum time elapsed
- Smooth 200ms transition before hiding loader

### usePageAccess Hook:
- Combines `useAccess()` and `useSuperAdmin()`
- Returns unified `isLoading` state
- Provides all access checking functions
- Single hook for all page access needs

## Testing

To verify the fix:
1. Clear browser cache
2. Navigate to any protected page
3. Should see smooth loader → content transition
4. No flash of "access denied" message
5. Consistent experience across all pages

