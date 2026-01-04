import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/organization/users/invitations/[token]
 * Get invitation details by token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
    const resolvedParams = 'then' in params ? await params : params;
    const { token } = resolvedParams;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get invitation
    const invitation = await db.selectOne<{
      id: string;
      organization_id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      role: string;
      profile_id: string | null;
      token: string;
      invitation_method: string;
      status: string;
      expires_at: Date;
      created_at: Date;
    }>('user_invitations', {
      eq: { token },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Update status to expired
      await db.update('user_invitations', {
        status: 'expired',
      }, {
        id: invitation.id,
      });

      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Get organization name
    const organization = await db.selectOne<{
      name: string;
    }>('organizations', {
      eq: { id: invitation.organization_id },
    });

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      phone: invitation.phone,
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      role: invitation.role,
      organizationId: invitation.organization_id,
      organizationName: organization?.name || null,
      status: invitation.status,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
    });
  } catch (error: any) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

