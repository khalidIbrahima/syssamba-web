import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-db';
import { userInvitations, users, organizations } from '@/db/schema';
// Clerk removed - using Supabase auth

/**
 * GET /api/invite/[token]
 * Get invitation details by token
 */
export async function GET(
  req: Request,
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

    // Get invitation with organization details
    const { data: invitationRecords, error: invitationError } = await supabaseAdmin
      .from('user_invitations')
      .select(`
        id,
        organization_id,
        email,
        first_name,
        last_name,
        phone,
        role,
        status,
        expires_at,
        organizations:organization_id (
          name
        )
      `)
      .eq('token', token)
      .limit(1);

    if (invitationError) {
      console.error('Error fetching invitation:', invitationError);
      return NextResponse.json(
        { error: 'Failed to fetch invitation' },
        { status: 500 }
      );
    }

    const invitation = invitationRecords[0];

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Update status to expired
      await supabaseAdmin
        .from('user_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    // Check if invitation is already accepted or cancelled
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        firstName: invitation.first_name,
        lastName: invitation.last_name,
        phone: invitation.phone,
        role: invitation.role,
        organizationName: invitation.organizations?.name || null,
        expiresAt: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invite/[token]/accept
 * Accept invitation and create user account
 */
export async function POST(
  req: Request,
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
    const invitationRecords = await db
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.token, token))
      .limit(1);

    const invitation = invitationRecords[0];

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if invitation is expired
    if (new Date(invitation.expiresAt) < new Date()) {
      await db
        .update(userInvitations)
        .set({ status: 'expired' })
        .where(eq(userInvitations.id, invitation.id));

      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Check if invitation is already accepted or cancelled
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status}` },
        { status: 400 }
      );
    }

    // Get the body (should contain userId after user signs up)
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, invitation.organizationId)
        )
      )
      .limit(1);

    if (existingUser.length > 0) {
      // User already exists, mark invitation as accepted
      await db
        .update(userInvitations)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
        })
        .where(eq(userInvitations.id, invitation.id));

      return NextResponse.json({
        message: 'User already exists in this organization',
        user: existingUser[0],
      });
    }

    // Create user in database
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        clerk_id: userId, // Keep for backward compatibility
        email: invitation.email,
        phone: invitation.phone || null,
        firstName: invitation.firstName || null,
        lastName: invitation.lastName || null,
        role: invitation.role,
        organizationId: invitation.organizationId,
        isActive: true,
      })
      .returning();

    // Mark invitation as accepted
    await db
      .update(userInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitation.id));

    return NextResponse.json({
      user: newUser,
      message: 'Invitation accepted successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

