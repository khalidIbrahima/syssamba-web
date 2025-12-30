# User Avatar Updates

## What Was Changed

The user avatar dropdown has been completely revamped to display comprehensive user information.

## New Features

### 1. **User Avatar Display**
- Shows user initials or profile picture
- Displays full name next to avatar (on large screens)
- Shows profile name or role badge

### 2. **Dropdown Menu Information**
When clicked, the avatar displays a dropdown with:
- **User Full Name** - First and last name
- **Email or Phone** - Contact information
- **Profile Name** - User's assigned profile (if available)
- **Organization Name** - Current organization
- **Role** - User role (Admin, Manager, Viewer, etc.)

### 3. **Menu Options**
- **Paramètres du compte** - Navigate to account settings
- **Gestion des utilisateurs** - Navigate to user management
- **Se déconnecter** - Logout option (in red)

## Technical Changes

### Files Modified:
1. **`src/components/ui/profile-avatar.tsx`**
   - Removed Clerk dependencies
   - Now uses Supabase auth system
   - Fetches data from `/api/user/profile`
   - Displays profile name, role, and organization
   - Improved UI with better information hierarchy

### Files Created:
2. **`src/app/api/user/profile/route.ts`**
   - New API endpoint that returns complete user profile
   - Fetches user data, organization name, and profile name
   - Returns formatted data for the avatar component

## Data Structure

```typescript
interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
  profileName: string | null;
}
```

## Display Logic

1. **Initials**: First letter of first name + first letter of last name
2. **Full Name**: First name + Last name (or email/phone if names not available)
3. **Profile Badge**: Shows profile name if available, otherwise shows role
4. **Role Display**:
   - `admin` → Administrateur
   - `manager` → Gestionnaire
   - `viewer` → Lecteur
   - `owner` → Propriétaire

## UI Improvements

### Before:
- Simple avatar with basic info
- Used Clerk's user data
- Limited information display

### After:
- ✅ Full user name displayed
- ✅ Profile name shown (e.g., "Gestionnaire Principal")
- ✅ Organization name displayed
- ✅ Role clearly indicated
- ✅ Email/phone visible
- ✅ Logout option prominent (red color)
- ✅ Smooth hover effects
- ✅ Better visual hierarchy
- ✅ Works with Supabase auth

## How It Works

1. Component loads and fetches user profile from `/api/user/profile`
2. API queries:
   - User data from `users` table
   - Organization name from `organizations` table
   - Profile name from `profiles` table
3. Data is cached with React Query (5 min stale time)
4. Avatar displays user initials or image
5. Clicking avatar opens dropdown with all information
6. Logout button signs out and redirects to `/auth/sign-in`

## Testing

To test the avatar:
1. Log in to the application
2. Look at the top-right corner of the header
3. Click on the avatar
4. Verify all information is displayed correctly:
   - Your full name
   - Your email/phone
   - Your profile name (if assigned)
   - Your organization
   - Your role
5. Click "Se déconnecter" to test logout

## Responsive Behavior

- **Mobile**: Shows only avatar icon
- **Desktop (lg screens)**: Shows avatar + name + profile badge + dropdown indicator
- Dropdown always displays full information regardless of screen size

