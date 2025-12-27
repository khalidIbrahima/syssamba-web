# Profile Permissions Structure

## Database Schema

### Current Structure

1. **`users` table**
   - `profile_id` (UUID) → References `profiles.id`
   - Each user has one profile that defines their permissions

2. **`profiles` table**
   - Stores profile definitions (e.g., "Administrateur", "Agent", "Lecteur")
   - Can be organization-specific or global

3. **`profile_object_permissions` table** (Junction table)
   - Links `profiles` to object-level permissions
   - Columns:
     - `profile_id` → References `profiles.id`
     - `object_type` → Object type (Property, Unit, Tenant, etc.)
     - `access_level` → None, Read, ReadWrite, All
     - `can_create`, `can_read`, `can_edit`, `can_delete`, `can_view_all`

4. **`profile_field_permissions` table** (Junction table)
   - Links `profiles` to field-level permissions
   - Columns:
     - `profile_id` → References `profiles.id`
     - `object_type` → Object type
     - `field_name` → Field name
     - `access_level` → None, Read, ReadWrite
     - `can_read`, `can_edit`, `is_sensitive`

## Data Flow

```
users.profile_id
    ↓
profiles.id
    ↓
profile_object_permissions (junction table)
    ↓
Object-level permissions (Property, Unit, Tenant, etc.)
```

## How It Works

1. User has `profile_id` in `users` table
2. Profile has permissions in `profile_object_permissions` table
3. Each permission entry links a profile to an object type with specific access levels
4. System reads permissions from `profile_object_permissions` based on user's `profile_id`

## Current Implementation

The system correctly uses:
- `users.profile_id` to get user's profile
- `profile_object_permissions` to get profile's object permissions
- `profile_field_permissions` to get profile's field permissions

## Functions

### Get User's Profile
```typescript
const user = await db.selectOne('users', { eq: { id: userId } });
const profileId = user.profile_id;
```

### Get Profile Permissions
```typescript
const permissions = await db.select('profile_object_permissions', {
  eq: { profile_id: profileId }
});
```

### Check Permission
```typescript
const permission = permissions.find(p => p.object_type === 'Property');
if (permission?.can_edit) {
  // User can edit properties
}
```

