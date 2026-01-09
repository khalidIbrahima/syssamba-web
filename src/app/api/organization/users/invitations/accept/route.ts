import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-db';
import { z } from 'zod';

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * POST /api/organization/users/invitations/accept
 * Accept an invitation and create user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = acceptInvitationSchema.parse(body);

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
      status: string;
      expires_at: Date;
    }>('user_invitations', {
      eq: { token: validatedData.token },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status}` },
        { status: 400 }
      );
    }

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

    if (!invitation.email) {
      return NextResponse.json(
        { error: 'Invitation email is missing' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.selectOne<{
      id: string;
      sb_user_id: string | null;
    }>('users', {
      eq: { email: invitation.email },
    });

    if (existingUser) {
      // User already exists - update invitation status
      await db.update('user_invitations', {
        status: 'accepted',
        accepted_at: new Date(),
      }, {
        id: invitation.id,
      });

      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Check plan user limits before creating user
    const { getOrganizationPlanLimits } = await import('@/lib/permissions');
    const { usersLimit } = await getOrganizationPlanLimits(invitation.organization_id);

    // Count current active users
    const activeUsers = await db.select<{ id: string }>('users', {
      eq: { organization_id: invitation.organization_id, is_active: true },
    });

    const currentUserCount = activeUsers.length;

    // Check if adding one more user would exceed the limit
    if (usersLimit !== null && currentUserCount >= usersLimit) {
      return NextResponse.json(
        { 
          error: `Limite d'utilisateurs atteinte. L'organisation a atteint sa limite de ${usersLimit} utilisateur${usersLimit > 1 ? 's' : ''}. Veuillez contacter l'administrateur pour mettre à niveau le plan.`,
          limitReached: true,
          currentCount: currentUserCount,
          limit: usersLimit,
        },
        { status: 403 }
      );
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      phone: invitation.phone || undefined,
      password: validatedData.password,
      email_confirm: true, // Auto-confirm email since they're accepting an invitation
      user_metadata: {
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        role: invitation.role,
        organization_id: invitation.organization_id,
        invitation_token: validatedData.token,
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating user in Supabase Auth:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user account' },
        { status: 500 }
      );
    }

    // Create user in database
    const newUser = await db.insertOne<{
      id: string;
      sb_user_id: string | null;
      organization_id: string | null;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      role: string;
      profile_id: string | null;
      is_active: boolean;
    }>('users', {
      id: authData.user.id, // Use Supabase auth user ID as primary key
      sb_user_id: authData.user.id,
      organization_id: invitation.organization_id,
      email: invitation.email,
      phone: invitation.phone || null,
      first_name: invitation.first_name || null,
      last_name: invitation.last_name || null,
      role: invitation.role,
      profile_id: invitation.profile_id || null,
      is_active: true,
    });

    if (!newUser) {
      // Rollback: delete auth user if database insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to create user in database' },
        { status: 500 }
      );
    }

    // Update invitation status
    await db.update('user_invitations', {
      status: 'accepted',
      accepted_at: new Date(),
    }, {
      id: invitation.id,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        phone: newUser.phone,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
      },
      message: 'Invitation accepted successfully',
    });
  } catch (error: any) {
    console.error('Error accepting invitation:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

