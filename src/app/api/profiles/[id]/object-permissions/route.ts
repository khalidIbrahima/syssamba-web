import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';
import {
  getProfile,
  setProfileObjectPermission,
  getProfileObjectPermissions,
} from '@/lib/profiles';
import { db } from '@/lib/db';
import { z } from 'zod';
import { isSuperAdmin } from '@/lib/super-admin';
import { isGlobalAdmin } from '@/lib/global-admin';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

const setObjectPermissionSchema = z.object({
  objectType: z.string(),
  accessLevel: z.enum(['None', 'Read', 'ReadWrite', 'All']),
  canCreate: z.boolean(),
  canRead: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canViewAll: z.boolean(),
});

/**
 * GET /api/profiles/[id]/object-permissions
 * Get all object-level permissions for a profile
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const profileId = resolvedParams.id;

    const permissions = await getProfileObjectPermissions(profileId);
    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error fetching object permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/profiles/[id]/object-permissions
 * Update multiple object-level permissions for a profile
 */
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const profileId = resolvedParams.id;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is super admin or global admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);
    const userIsGlobalAdmin = await isGlobalAdmin(user.id);

    // If user is not super admin or global admin, check their permissions
    if (!userIsSuperAdmin && !userIsGlobalAdmin) {
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

      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const canEditProfile = objectPermissions.find((p: any) => p.objectType === 'Profile')?.canEdit;
      const canEditOrg = objectPermissions.find((p: any) => p.objectType === 'Organization')?.canEdit;
      const canEditUsers = objectPermissions.find((p: any) => p.objectType === 'User')?.canEdit;

      if (!canEditProfile && !canEditOrg && !canEditUsers) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    const profile = await getProfile(profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // If user is not super admin or global admin, verify profile belongs to user's organization
    if (!userIsSuperAdmin && !userIsGlobalAdmin) {
      if (!user.organizationId) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      if (profile.organizationId !== user.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await req.json();
    const { permissions } = body;

    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Permissions must be an array' }, { status: 400 });
    }

    // Update all permissions
    for (const perm of permissions) {
      const validatedData = setObjectPermissionSchema.parse(perm);
      await setProfileObjectPermission(
        profileId,
        validatedData.objectType as ObjectType,
        {
          accessLevel: validatedData.accessLevel,
          canCreate: validatedData.canCreate,
          canRead: validatedData.canRead,
          canEdit: validatedData.canEdit,
          canDelete: validatedData.canDelete,
          canViewAll: validatedData.canViewAll,
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating object permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/profiles/[id]/object-permissions
 * Set object-level permission for a profile
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const profileId = resolvedParams.id;

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is super admin or global admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);
    const userIsGlobalAdmin = await isGlobalAdmin(user.id);

    // If user is not super admin or global admin, check their permissions
    if (!userIsSuperAdmin && !userIsGlobalAdmin) {
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
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const canEditProfile = objectPermissions.find((p: any) => p.objectType === 'Profile')?.canEdit;
      const canEditOrg = objectPermissions.find((p: any) => p.objectType === 'Organization')?.canEdit;
      const canEditUsers = objectPermissions.find((p: any) => p.objectType === 'User')?.canEdit;

      if (!canEditProfile && !canEditOrg && !canEditUsers) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions to set permissions' },
          { status: 403 }
        );
      }
    }

    const profile = await getProfile(profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // If user is not super admin or global admin, verify profile belongs to user's organization
    if (!userIsSuperAdmin && !userIsGlobalAdmin) {
      if (!user.organizationId) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      if (profile.organizationId !== user.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await req.json();
    const validatedData = setObjectPermissionSchema.parse(body);

    const success = await setProfileObjectPermission(
      profileId,
      validatedData.objectType as ObjectType,
      {
        accessLevel: validatedData.accessLevel,
        canCreate: validatedData.canCreate,
        canRead: validatedData.canRead,
        canEdit: validatedData.canEdit,
        canDelete: validatedData.canDelete,
        canViewAll: validatedData.canViewAll,
      }
    );

    if (!success) {
      return NextResponse.json({ error: 'Failed to set permission' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error setting object permission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

