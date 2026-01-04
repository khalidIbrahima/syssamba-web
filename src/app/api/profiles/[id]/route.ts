import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';
import {
  getProfile,
  updateProfile,
  deleteProfile,
  getProfileObjectPermissions,
  getProfileFieldPermissions,
  setProfileObjectPermission,
  setProfileFieldPermission,
} from '@/lib/profiles';
import { db } from '@/lib/db';
import { z } from 'zod';
import { isSuperAdmin } from '@/lib/super-admin';
import { isGlobalAdmin } from '@/lib/global-admin';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

const setObjectPermissionSchema = z.object({
  objectType: z.string(),
  accessLevel: z.enum(['None', 'Read', 'ReadWrite', 'All']),
  canCreate: z.boolean(),
  canRead: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canViewAll: z.boolean(),
});

const setFieldPermissionSchema = z.object({
  objectType: z.string(),
  fieldName: z.string(),
  accessLevel: z.enum(['None', 'Read', 'ReadWrite']),
  canRead: z.boolean(),
  canEdit: z.boolean(),
  isSensitive: z.boolean().optional(),
});

/**
 * GET /api/profiles/[id]
 * Get a single profile with its permissions
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

    const objectPermissions = await getProfileObjectPermissions(profileId);
    const fieldPermissions = await getProfileFieldPermissions(profileId);

    return NextResponse.json({
      ...profile,
      objectPermissions,
      fieldPermissions,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/profiles/[id]
 * Update a profile
 */
export async function PATCH(
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
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission to update profiles (via profile permissions)
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
        { error: 'Forbidden: Insufficient permissions to update profiles' },
        { status: 403 }
      );
    }

    const profile = await getProfile(profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify profile belongs to user's organization
    if (profile.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Allow modification of system profiles if user has proper permissions
    // System profiles can be modified by admins to adjust permissions
    // Only prevent deletion, not modification of permissions

    const body = await req.json();
    const validatedData = updateProfileSchema.parse(body);

    const success = await updateProfile(profileId, validatedData);
    if (!success) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    const updatedProfile = await getProfile(profileId);
    return NextResponse.json(updatedProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/profiles/[id]
 * Delete a profile
 */
export async function DELETE(
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
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission to delete profiles (via profile permissions)
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
        { error: 'Forbidden: Insufficient permissions to delete profiles' },
        { status: 403 }
      );
    }

    const profile = await getProfile(profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify profile belongs to user's organization
    if (profile.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const success = await deleteProfile(profileId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting profile:', error);
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
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission to set permissions (via profile permissions)
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

    const profile = await getProfile(profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify profile belongs to user's organization
    if (profile.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

/**
 * POST /api/profiles/[id]/field-permissions
 * Set field-level permission for a profile
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

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission to set permissions (via profile permissions)
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

    const profile = await getProfile(profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify profile belongs to user's organization
    if (profile.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

