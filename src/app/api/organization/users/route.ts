import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(['owner', 'admin', 'manager', 'viewer']).default('viewer'),
});

/**
 * GET /api/organization/users
 * Get all users in the current user's organization
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

    // Get all users in the organization
    const orgUsers = await db.select<{
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
      created_at: Date | string;
    }>('users', {
      eq: { organization_id: user.organizationId },
      orderBy: { column: 'created_at', ascending: true },
    });

    // Get total count of active users
    const totalCount = await db.count('users', {
      organization_id: user.organizationId,
      is_active: true,
    });

    // Get pending invitations
    const pendingInvitations = await db.select<{
      id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      role: string;
      invitation_method: string;
      status: string;
      expires_at: Date | string;
      sent_at: Date | string | null;
      created_at: Date | string;
    }>('user_invitations', {
      eq: { 
        organization_id: user.organizationId,
        status: 'pending',
      },
      orderBy: { column: 'created_at', ascending: true },
    });

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      users: orgUsers.map(user => ({
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
      })),
      invitations: pendingInvitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        phone: inv.phone,
        firstName: inv.first_name,
        lastName: inv.last_name,
        role: inv.role,
        invitationMethod: inv.invitation_method,
        status: inv.status,
        expiresAt: inv.expires_at,
        sentAt: inv.sent_at,
        createdAt: inv.created_at,
      })),
      totalCount: totalCount || 0,
      pendingInvitationsCount: pendingInvitations.length,
      currentUser: {
        id: user.id,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error fetching organization users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/users
 * Create a user invitation (redirects to invite endpoint)
 * This endpoint is kept for backward compatibility but now creates invitations
 */
export async function POST(req: Request) {
  // Redirect to invite endpoint
  const inviteResponse = await fetch(new URL('/api/organization/users/invite', req.url), {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(await req.json()),
  });

  return inviteResponse;
}

