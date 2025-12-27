# Migration from Role-Based to Profile-Based Security

## Summary

All role-based security checks have been removed and replaced with profile-based security checks. The system now uses:

1. **Plan Features** - Features enabled/disabled per subscription plan
2. **Profile Permissions** - Object-level and field-level permissions based on user profiles

## Changes Made

### API Routes Updated

All API routes that previously checked `user.role !== 'owner' && user.role !== 'admin'` have been updated to use `canUserPerformAction()` from `access-control.ts`:

- ✅ `/api/organization/users/[id]` - Uses `canUserPerformAction(userId, organizationId, 'User', 'edit'/'delete')`
- ✅ `/api/organization/users/invite` - Uses `canUserPerformAction(userId, organizationId, 'User', 'create')`
- ✅ `/api/organization/users/roles` - Uses `canUserPerformAction(userId, organizationId, 'User', 'read'/'edit')`
- ✅ `/api/organization/route` - Uses `canUserPerformAction(userId, organizationId, 'Organization', 'edit')`
- ✅ `/api/organization/users/plan-features` - Uses `canUserPerformAction(userId, organizationId, 'Organization', 'edit')`
- ✅ `/api/organization/users/permissions-matrix` - Uses `canUserPerformAction(userId, organizationId, 'User', 'read'/'edit')`

### Frontend Pages Updated

All frontend pages that previously checked `currentUserRole === 'owner' || currentUserRole === 'admin'` have been updated to use `canAccessObject()` from `useAccess()`:

- ✅ `/settings/users` - Uses `canAccessObject('User', 'edit')` and `canAccessObject('Organization', 'edit')`

### Library Functions Updated

- ✅ `src/lib/access-control.ts` - Added `canUserPerformAction()` function for server-side profile-based checks
- ✅ `src/lib/salesforce-inspired-security.ts` - Updated `SecurityContext` to use `profileId` instead of `role`, updated `checkRecordAccess()` and `checkFieldAccess()` to use profile permissions
- ✅ `src/hooks/use-security.ts` - Updated to use `profileId` instead of `role`

### Deprecated Functions

The following functions are marked as deprecated but kept for backward compatibility:

- `getObjectPermission()` in `salesforce-inspired-security.ts` - Use `getProfileObjectPermissions()` instead
- `getFieldPermission()` in `salesforce-inspired-security.ts` - Use `getProfileFieldPermissions()` instead

## What Remains

### Role Field in Database

The `role` field in the `users` table is still present for:
- **Backward compatibility** - Existing data
- **Display purposes** - Showing user roles in UI (not for security)
- **Statistics** - Counting users by role
- **Legacy mapping** - When assigning profiles to users based on their old role

### Role References for Display

Some references to `user.role` remain but are **NOT used for security**:
- Displaying role labels in UI (`roleLabels[user.role]`)
- User statistics (`roleCounts[role]`)
- API responses that include role for display purposes

## Security Model

The new security model works as follows:

1. **Plan Features Check** - Is the feature enabled for the user's plan?
2. **Profile Permissions Check** - Does the user's profile have permission for the action?

Both checks must pass for access to be granted.

## Migration Path

1. ✅ All security checks now use profiles
2. ✅ API routes use `canUserPerformAction()` 
3. ✅ Frontend pages use `canAccessObject()` from `useAccess()`
4. ⚠️ Role field still exists in database (for display/legacy purposes)
5. ⚠️ Some deprecated functions remain for backward compatibility

## Next Steps (Optional)

- Consider removing the `role` field from the database schema (after ensuring all legacy data is migrated)
- Remove deprecated functions after confirming no code depends on them
- Update API responses to not include `role` if it's not needed for display

