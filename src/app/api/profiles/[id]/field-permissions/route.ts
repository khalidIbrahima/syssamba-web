import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';
import {
  getProfile,
  setProfileFieldPermission,
  getProfileObjectPermissions,
  getProfileFieldPermissions,
} from '@/lib/profiles';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';
import { isGlobalAdmin } from '@/lib/global-admin';
import { z } from 'zod';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

const setFieldPermissionSchema = z.object({
  objectType: z.string(),
  fieldName: z.string(),
  accessLevel: z.enum(['None', 'Read', 'ReadWrite']),
  canRead: z.boolean(),
  canEdit: z.boolean(),
  isSensitive: z.boolean().optional(),
});

/**
 * GET /api/profiles/[id]/field-permissions
 * Get all field-level permissions for a profile
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

    // Check if user is super admin or global admin
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userIsSuperAdmin = await isSuperAdmin(user.id);
    const userIsGlobalAdmin = await isGlobalAdmin(user.id);

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

      // Check if user's profile allows editing Organization or User objects
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const canEditOrg = objectPermissions.find((p: any) => p.objectType === 'Organization')?.canEdit;
      const canEditUsers = objectPermissions.find((p: any) => p.objectType === 'User')?.canEdit;

      if (!canEditOrg && !canEditUsers) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Get field permissions for the profile
    const fieldPermissions = await getProfileFieldPermissions(profileId);

    return NextResponse.json(fieldPermissions);
  } catch (error) {
    console.error('Error fetching field permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/profiles/[id]/field-permissions
 * Set field-level permission for a profile
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

      // Check if user's profile allows editing Organization or User objects
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const canEditOrg = objectPermissions.find((p: any) => p.objectType === 'Organization')?.canEdit;
      const canEditUsers = objectPermissions.find((p: any) => p.objectType === 'User')?.canEdit;

      if (!canEditOrg && !canEditUsers) {
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
    const validatedData = setFieldPermissionSchema.parse(body);

    const success = await setProfileFieldPermission(
      profileId,
      validatedData.objectType as ObjectType,
      validatedData.fieldName,
      {
        accessLevel: validatedData.accessLevel,
        canRead: validatedData.canRead,
        canEdit: validatedData.canEdit,
        isSensitive: validatedData.isSensitive,
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
    console.error('Error setting field permission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

