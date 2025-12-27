# Profile Access Level Documentation

## Overview

The profile access level system analyzes a user's profile permissions to determine their overall access capabilities. This helps understand what actions a user can perform across the system.

## Access Levels

The system uses 4 access levels (inspired by Salesforce):

1. **None** - No access to the object
2. **Read** - Can only read/view the object
3. **ReadWrite** - Can read and modify the object
4. **All** - Full access (read, create, edit, delete, view all)

## Usage

### Server-Side

```typescript
import { analyzeProfileAccessLevel, getUserProfileAccessLevel } from '@/lib/security/profile-access-level';

// Analyze a specific profile
const summary = await analyzeProfileAccessLevel(profileId);

// Get user's profile access level (convenience function)
const userSummary = await getUserProfileAccessLevel(userId);

if (userSummary) {
  console.log('Overall access level:', userSummary.overallAccessLevel);
  console.log('Can create any object:', userSummary.canCreateAny);
  console.log('Can edit any object:', userSummary.canEditAny);
  console.log('Accessible objects:', userSummary.accessibleObjects);
}
```

### Client-Side Hook

```typescript
import { useProfileAccessLevel } from '@/hooks/use-profile-access-level';

function MyComponent() {
  const {
    overallAccessLevel,
    profileName,
    canCreateAny,
    canEditAny,
    canDeleteAny,
    canViewAllAny,
    hasMinimumAccessForObject,
    getObjectAccessLevel,
  } = useProfileAccessLevel();

  // Check if user has minimum access for Property
  const canEditProperties = hasMinimumAccessForObject('Property', 'ReadWrite');

  // Get access level for specific object
  const propertyAccess = getObjectAccessLevel('Property');

  return (
    <div>
      <p>Profile: {profileName}</p>
      <p>Overall Access: {overallAccessLevel}</p>
      <p>Can Create: {canCreateAny ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

### React Components

```typescript
import { ProfileAccessBadge, ProfileAccessDetails } from '@/components/security';

// Simple badge showing access level
<ProfileAccessBadge showDetails />

// Detailed access information card
<ProfileAccessDetails />
```

## API Route

### GET /api/user/profile-access-level

Returns the current user's profile access level summary.

**Response:**
```json
{
  "profileId": "uuid",
  "profileName": "Administrateur",
  "overallAccessLevel": "All",
  "objectAccessLevels": {
    "Property": "All",
    "Unit": "ReadWrite",
    "Tenant": "Read"
  },
  "canCreateAny": true,
  "canEditAny": true,
  "canDeleteAny": true,
  "canViewAllAny": true,
  "totalObjects": 12,
  "accessibleObjects": 12,
  "permissions": [...]
}
```

## Functions

### `analyzeProfileAccessLevel(profileId: string)`

Analyzes a profile's permissions and returns a comprehensive summary.

**Returns:**
- `ProfileAccessSummary | null`

### `getUserProfileAccessLevel(userId: string)`

Convenience function that gets the user's profile first, then analyzes it.

**Returns:**
- `ProfileAccessSummary | null`

### `hasMinimumAccessLevel(profileId, objectType, minimumLevel)`

Checks if a profile has at least the minimum access level for an object type.

**Example:**
```typescript
const canEdit = await hasMinimumAccessLevel(
  profileId,
  'Property',
  'ReadWrite'
);
```

### `hasAccessLevelOrHigher(level1, level2)`

Compares two access levels. Returns true if level1 is at least as permissive as level2.

**Example:**
```typescript
hasAccessLevelOrHigher('All', 'ReadWrite'); // true
hasAccessLevelOrHigher('Read', 'ReadWrite'); // false
```

### `getAccessLevelDescription(level)`

Returns a human-readable description of an access level.

**Example:**
```typescript
getAccessLevelDescription('ReadWrite'); // "Lecture et écriture"
```

## ProfileAccessSummary Interface

```typescript
interface ProfileAccessSummary {
  profileId: string;
  profileName: string;
  overallAccessLevel: AccessLevel;
  objectAccessLevels: Record<ObjectType, AccessLevel>;
  canCreateAny: boolean;
  canEditAny: boolean;
  canDeleteAny: boolean;
  canViewAllAny: boolean;
  totalObjects: number;
  accessibleObjects: number;
  permissions: ProfileObjectPermission[];
}
```

## Use Cases

1. **Display user capabilities** - Show what a user can do
2. **Access control** - Check if user has minimum access before allowing action
3. **UI customization** - Show/hide features based on access level
4. **Audit and reporting** - Understand access patterns
5. **Onboarding** - Explain to users what they can access

## Integration with Security System

The profile access level system integrates with the hierarchical security system:

1. **Plan Features** (Level 1) - What features are available
2. **Profile Security** (Level 2) - What actions profile allows ← **This system**
3. **Object Security** (Level 3) - What objects user can access
4. **Field Security** (Level 4) - What fields user can see/edit

The profile access level provides a high-level view of Level 2 (Profile Security).

