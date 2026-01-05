import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';
import { canUserPerformAction } from '@/lib/access-control';
import { z } from 'zod';

const updateUserSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis').optional(),
  lastName: z.string().min(1, 'Le nom est requis').optional(),
  email: z.string().email('Email invalide').optional(),
  phone: z.string().optional(),
  profileId: z.string().uuid('Profil invalide').optional(),
  isActive: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(), // Only super admins can set this
});

/**
 * PATCH /api/organization/users/[id]
 * Update a user in the current user's organization
 * Non-super-admin users cannot update users to super admin status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if current user is super admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    // Check permission to edit users
    // Allow admin and owner roles to manage users, in addition to profile-based permissions
    const canEditByProfile = await canUserPerformAction(userId, user.organizationId, 'User', 'edit');
    const canEditByRole = user.role === 'admin' || user.role === 'owner';
    const canEdit = canEditByProfile || canEditByRole;
    
    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to edit users' },
        { status: 403 }
      );
    }

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get the user to update
    const userToUpdate = await db.selectOne<{
      id: string;
      organization_id: string | null;
      is_super_admin: boolean;
    }>('users', {
      eq: { id },
    });

    if (!userToUpdate) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Non-super-admin users cannot see or edit super admin users
    if (!userIsSuperAdmin && userToUpdate.is_super_admin) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot edit super admin users' },
        { status: 403 }
      );
    }

    // Verify user belongs to the same organization (unless current user is super admin)
    if (!userIsSuperAdmin && userToUpdate.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Non-super-admin users cannot set isSuperAdmin to true
    if (!userIsSuperAdmin && validatedData.isSuperAdmin === true) {
      return NextResponse.json(
        { error: 'Forbidden: Only super admins can grant super admin status' },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (validatedData.firstName !== undefined) {
      updateData.first_name = validatedData.firstName;
    }
    if (validatedData.lastName !== undefined) {
      updateData.last_name = validatedData.lastName;
    }
    if (validatedData.email !== undefined) {
      updateData.email = validatedData.email;
    }
    if (validatedData.phone !== undefined) {
      updateData.phone = validatedData.phone;
    }
    if (validatedData.profileId !== undefined) {
      updateData.profile_id = validatedData.profileId || null;
    }
    if (validatedData.isActive !== undefined) {
      updateData.is_active = validatedData.isActive;
    }
    // Only super admins can update is_super_admin
    if (userIsSuperAdmin && validatedData.isSuperAdmin !== undefined) {
      updateData.is_super_admin = validatedData.isSuperAdmin;
    }

    // Update user
    const updatedUser = await db.updateOne<{
      id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      profile_id: string | null;
      is_active: boolean;
      is_super_admin: boolean;
      updated_at: Date | null;
    }>('users', updateData, { id });

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      phone: updatedUser.phone,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      profileId: updatedUser.profile_id,
      isActive: updatedUser.is_active,
      isSuperAdmin: updatedUser.is_super_admin,
      updatedAt: updatedUser.updated_at instanceof Date ? updatedUser.updated_at.toISOString() : (updatedUser.updated_at || null),
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

