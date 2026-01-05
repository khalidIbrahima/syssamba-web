import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';

/**
 * GET /api/organization/users
 * Get all users in the current user's organization
 * Non-super-admin users cannot see super admin users
 */
export async function GET() {
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

    // Get all users in the organization
    const users = await db.select<{
      id: string;
      email: string;
      full_name: string | null;
      role: string;
      profile_id: string | null;
      organization_id: string | null;
      is_active: boolean;
      is_super_admin: boolean;
      created_at: Date;
      updated_at: Date | null;
    }>('users', {
      eq: { organization_id: organization.id },
      orderBy: { column: 'created_at', ascending: false },
    });

    // Filter out super admin users for non-super-admin users
    const filteredUsers = userIsSuperAdmin 
      ? users 
      : users.filter(u => !u.is_super_admin);

    // Map snake_case to camelCase for API response
    const mappedUsers = filteredUsers.map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      firstName: u.full_name ? u.full_name.split(' ')[0] : null,
      lastName: u.full_name ? u.full_name.split(' ').slice(1).join(' ') : null,
      role: u.role,
      profileId: u.profile_id,
      organizationId: u.organization_id,
      isActive: u.is_active,
      isSuperAdmin: u.is_super_admin,
      createdAt: u.created_at instanceof Date ? u.created_at.toISOString() : u.created_at,
      updatedAt: u.updated_at instanceof Date ? u.updated_at.toISOString() : (u.updated_at || null),
    }));

    // Get pending invitations for the organization
    const invitations = await db.select<{
      id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      role: string;
      status: string;
      created_at: Date;
      expires_at: Date;
    }>('user_invitations', {
      eq: { organization_id: organization.id, status: 'pending' },
      orderBy: { column: 'created_at', ascending: false },
    });

    const mappedInvitations = invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      phone: inv.phone,
      firstName: inv.first_name,
      lastName: inv.last_name,
      role: inv.role,
      status: inv.status,
      createdAt: inv.created_at instanceof Date ? inv.created_at.toISOString() : inv.created_at,
      expiresAt: inv.expires_at instanceof Date ? inv.expires_at.toISOString() : inv.expires_at,
    }));

    return NextResponse.json({
      users: mappedUsers,
      invitations: mappedInvitations,
      totalCount: mappedUsers.length,
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

