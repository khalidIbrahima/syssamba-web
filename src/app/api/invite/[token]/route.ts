import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userInvitations, users, organizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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

    // Get invitation
    const invitationRecords = await db
      .select({
        id: userInvitations.id,
        organizationId: userInvitations.organizationId,
        email: userInvitations.email,
        firstName: userInvitations.firstName,
        lastName: userInvitations.lastName,
        phone: userInvitations.phone,
        role: userInvitations.role,
        status: userInvitations.status,
        expiresAt: userInvitations.expiresAt,
        organizationName: organizations.name,
      })
      .from(userInvitations)
      .leftJoin(organizations, eq(userInvitations.organizationId, organizations.id))
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
      // Update status to expired
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

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        phone: invitation.phone,
        role: invitation.role,
        organizationName: invitation.organizationName,
        expiresAt: invitation.expiresAt,
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

