import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { canUserPerformAction } from '@/lib/access-control';
import { z } from 'zod';

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['owner', 'admin', 'accountant', 'agent', 'viewer']).optional(),
  profileId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/organization/users/[id]
 * Get a single user by ID
 */
export async function GET(
  req: Request,
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

    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
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

    // Get user
    const user = await db.selectOne<{
      id: string;
      clerk_id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      role: string;
      profile_id: string | null;
      avatar_url: string | null;
      is_active: boolean;
      organization_id: string | null;
      created_at: Date | string;
    }>('users', {
      eq: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user belongs to current user's organization
    if (user.organization_id !== currentUser.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: user.id,
      clerkId: user.clerk_id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      profileId: user.profile_id,
      avatarUrl: user.avatar_url,
      isActive: user.is_active,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organization/users/[id]
 * Update a user
 */
export async function PATCH(
  req: Request,
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

    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if current user has permission to edit users (profile-based)
    const canEdit = await canUserPerformAction(
      currentUser.id,
      currentUser.organizationId,
      'User',
      'edit'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to edit users' },
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

    // Get user to verify they exist and belong to organization
    const existingUser = await db.selectOne<{
      id: string;
      organization_id: string | null;
      role: string;
    }>('users', {
      eq: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user belongs to current user's organization
    if (existingUser.organization_id !== currentUser.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = updateUserSchema.parse(body);

    // Prevent editing own profile (users can't change their own profile)
    if (id === currentUser.id && validatedData.profileId && validatedData.profileId !== currentUser.profileId) {
      return NextResponse.json(
        { error: 'You cannot change your own profile' },
        { status: 400 }
      );
    }

    // If profileId is provided, verify it belongs to the organization
    if (validatedData.profileId) {
      const profile = await db.selectOne<{
        organization_id: string;
      }>('profiles', {
        eq: { id: validatedData.profileId },
      });

      if (!profile) {
        return NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 }
        );
      }

      if (profile.organization_id !== currentUser.organizationId) {
        return NextResponse.json(
          { error: 'Profile does not belong to your organization' },
          { status: 403 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, any> = {};
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
    if (validatedData.role !== undefined) {
      updateData.role = validatedData.role;
    }
    if (validatedData.profileId !== undefined) {
      updateData.profile_id = validatedData.profileId;
    }
    if (validatedData.isActive !== undefined) {
      updateData.is_active = validatedData.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await db.updateOne<{
      id: string;
      clerk_id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      role: string;
      profile_id: string | null;
      avatar_url: string | null;
      is_active: boolean;
      organization_id: string | null;
      created_at: Date | string;
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
      clerkId: updatedUser.clerk_id,
      email: updatedUser.email,
      phone: updatedUser.phone,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      role: updatedUser.role,
      profileId: updatedUser.profile_id,
      avatarUrl: updatedUser.avatar_url,
      isActive: updatedUser.is_active,
      createdAt: updatedUser.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organization/users/[id]
 * Delete (deactivate) a user
 */
export async function DELETE(
  req: Request,
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

    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if current user has permission to delete users (profile-based)
    const canDelete = await canUserPerformAction(
      currentUser.id,
      currentUser.organizationId,
      'User',
      'delete'
    );
    if (!canDelete) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to delete users' },
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

    // Prevent deleting self
    if (id === currentUser.id) {
      return NextResponse.json(
        { error: 'You cannot delete yourself' },
        { status: 400 }
      );
    }

    // Get user to verify they exist and belong to organization
    const existingUser = await db.selectOne<{
      id: string;
      organization_id: string | null;
      role: string;
    }>('users', {
      eq: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user belongs to current user's organization
    if (existingUser.organization_id !== currentUser.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Prevent deleting self
    if (id === currentUser.id) {
      return NextResponse.json(
        { error: 'You cannot delete yourself' },
        { status: 400 }
      );
    }

    // Deactivate user instead of deleting (soft delete)
    await db.updateOne('users', { is_active: false }, { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
