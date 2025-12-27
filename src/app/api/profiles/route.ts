import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';
import {
  getProfiles,
  createProfile,
} from '@/lib/profiles';
import { isSuperAdmin } from '@/lib/super-admin';
import { db } from '@/lib/db';
import { z } from 'zod';

const createProfileSchema = z.object({
  name: z.string().min(1, 'Le nom du profil est requis').max(100),
  description: z.string().max(500).optional(),
});

/**
 * GET /api/profiles
 * Get all profiles for the current organization
 * Query params:
 *   - organizationId: Filter by specific organization (super admin only)
 *   - getAll: If true, return all profiles from all organizations (super admin only)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is super admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const filterOrganizationId = searchParams.get('organizationId');
    const getAll = searchParams.get('getAll') === 'true';

    // Regular users need an organization
    if (!userIsSuperAdmin && !user.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    let profiles;
    if (userIsSuperAdmin) {
      // Super admin: can get all profiles or filter by organization
      if (getAll) {
        // Get all profiles from all organizations
        profiles = await getProfiles(null, true);
      } else if (filterOrganizationId) {
        // Filter by specific organization
        profiles = await getProfiles(filterOrganizationId, false);
      } else if (user.organizationId) {
        // Use user's selected organization
        profiles = await getProfiles(user.organizationId, false);
      } else {
        // Super admin without organization: return global system profiles only
        profiles = await getProfiles(null, false);
      }
    } else {
      // Regular user: get profiles for their organization (includes global system profiles)
      profiles = await getProfiles(user.organizationId!, false);
    }

    // Enrich profiles with organization names for super admin
    if (userIsSuperAdmin && profiles.length > 0) {
      const organizationIds = [...new Set(profiles.map(p => p.organizationId).filter(Boolean))];
      if (organizationIds.length > 0) {
        const organizations = await db.select<{
          id: string;
          name: string | null;
        }>('organizations', {
          in: { id: organizationIds },
        });
        
        const orgMap = new Map(organizations.map(org => [org.id, org.name]));
        profiles = profiles.map(profile => ({
          ...profile,
          organizationName: profile.organizationId ? orgMap.get(profile.organizationId) || null : null,
        }));
      }
    }

    console.log(`[GET /api/profiles] Returning ${profiles.length} profiles for organization ${filterOrganizationId || user.organizationId || 'all'}`);

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/profiles
 * Create a new profile (organization-specific, not global)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is super admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    // Super admin can create profiles without organization check
    // Regular users need an organization
    if (!userIsSuperAdmin && !user.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check permissions (skip for super admin)
    if (!userIsSuperAdmin) {
      // Check if user has permission to create profiles (via profile permissions)
      const userRecord = await db.selectOne<{
        profile_id: string | null;
      }>('users', {
        eq: { id: user.id },
      });

      if (!userRecord?.profile_id) {
        return NextResponse.json(
          { error: 'User has no profile assigned' },
          { status: 403 }
        );
      }

      // Check if user's profile allows editing Profile objects (preferred) or Organization/User objects (fallback)
      const { getProfileObjectPermissions } = await import('@/lib/profiles');
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const canEditProfile = objectPermissions.find((p: any) => p.objectType === 'Profile')?.canEdit;
      const canEditOrg = objectPermissions.find((p: any) => p.objectType === 'Organization')?.canEdit;
      const canEditUsers = objectPermissions.find((p: any) => p.objectType === 'User')?.canEdit;

      if (!canEditProfile && !canEditOrg && !canEditUsers) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions to create profiles' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const validatedData = createProfileSchema.parse(body);

    // Create organization-specific profile (not global)
    // Super admin must have an organization selected to create profiles
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization must be selected to create profiles' },
        { status: 400 }
      );
    }

    const profile = await createProfile(
      organizationId,
      validatedData.name,
      validatedData.description
    );

    if (!profile) {
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

