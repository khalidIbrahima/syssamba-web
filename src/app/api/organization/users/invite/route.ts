import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { userInvitations, users, organizations, subscriptions, plans } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { canUserPerformAction } from '@/lib/access-control';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const inviteUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['owner', 'admin', 'accountant', 'agent', 'viewer']).default('viewer'),
  invitationMethod: z.enum(['email', 'sms', 'both']).default('email'),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone must be provided',
  path: ['email'],
});

/**
 * POST /api/organization/users/invite
 * Create a user invitation
 * Only admins and owners can invite users
 */
export async function POST(req: Request) {
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

    // Check if user has permission to create users (profile-based)
    const canCreate = await canUserPerformAction(
      currentUser.id,
      currentUser.organizationId,
      'User',
      'create'
    );
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to invite users' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = inviteUserSchema.parse(body);

    // Validate that at least email or phone is provided based on invitation method
    if (validatedData.invitationMethod === 'email' && !validatedData.email) {
      return NextResponse.json(
        { error: 'Email is required when invitation method is email' },
        { status: 400 }
      );
    }

    if (validatedData.invitationMethod === 'sms' && !validatedData.phone) {
      return NextResponse.json(
        { error: 'Phone is required when invitation method is SMS' },
        { status: 400 }
      );
    }

    // Check if user already exists in the organization (by email or phone)
    const conditions = [eq(users.organizationId, currentUser.organizationId)];
    if (validatedData.email) {
      conditions.push(eq(users.email, validatedData.email));
    }
    if (validatedData.phone) {
      conditions.push(eq(users.phone, validatedData.phone));
    }

    const existingUser = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'User with this email or phone already exists in this organization' },
        { status: 400 }
      );
    }

    // Check if there's already a pending invitation
    const invitationConditions = [
      eq(userInvitations.organizationId, currentUser.organizationId),
      eq(userInvitations.status, 'pending')
    ];

    if (validatedData.email) {
      invitationConditions.push(eq(userInvitations.email, validatedData.email));
    }
    if (validatedData.phone) {
      invitationConditions.push(eq(userInvitations.phone, validatedData.phone));
    }

    const existingInvitation = await db
      .select()
      .from(userInvitations)
      .where(and(...invitationConditions))
      .limit(1);

    if (existingInvitation.length > 0) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email or phone' },
        { status: 400 }
      );
    }

    // Check user limit from subscription/plan
    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const subscriptionRecords = await db
      .select({ planId: subscriptions.planId })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organization.id))
      .orderBy(subscriptions.createdAt)
      .limit(1);

    let usersLimit: number | null = null;
    if (subscriptionRecords[0]?.planId) {
      const planRecords = await db
        .select({ usersLimit: plans.usersLimit })
        .from(plans)
        .where(eq(plans.id, subscriptionRecords[0].planId))
        .limit(1);
      
      usersLimit = planRecords[0]?.usersLimit || null;
    }

    // Count current active users
    const [currentUsersCount] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.organizationId, currentUser.organizationId),
          eq(users.isActive, true)
        )
      );

    // Count pending invitations
    const [pendingInvitationsCount] = await db
      .select({ count: count() })
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.organizationId, currentUser.organizationId),
          eq(userInvitations.status, 'pending')
        )
      );

    const totalUsers = (currentUsersCount?.count || 0) + (pendingInvitationsCount?.count || 0);

    if (usersLimit !== null && usersLimit !== -1 && totalUsers >= usersLimit) {
      return NextResponse.json(
        { error: `User limit reached (${usersLimit} users). Please upgrade your plan.` },
        { status: 403 }
      );
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex');
    
    // Set expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const [invitation] = await db
      .insert(userInvitations)
      .values({
        organizationId: currentUser.organizationId,
        email: validatedData.email || null,
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
        phone: validatedData.phone || null,
        role: validatedData.role,
        token,
        invitationMethod: validatedData.invitationMethod,
        invitedBy: currentUser.id,
        expiresAt,
        sentAt: new Date(), // Mark as sent when created
      })
      .returning();

    // Generate invitation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/invite/${token}`;

    // TODO: Send invitation via email or SMS based on invitationMethod
    // For email: Use email service (SendGrid, Resend, etc.)
    // For SMS: Use SMS service (Twilio, Orange SMS API, etc.)
    // For now, we'll return the URL in the response
    
    let sendMessage = '';
    if (validatedData.invitationMethod === 'email') {
      sendMessage = 'Please send the invitation link to the user via email.';
    } else if (validatedData.invitationMethod === 'sms') {
      sendMessage = 'Please send the invitation link to the user via SMS.';
    } else {
      sendMessage = 'Please send the invitation link to the user via email and SMS.';
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        phone: invitation.phone,
        role: invitation.role,
        invitationMethod: invitation.invitationMethod,
        expiresAt: invitation.expiresAt,
      },
      invitationUrl,
      message: `Invitation created successfully. ${sendMessage}`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

