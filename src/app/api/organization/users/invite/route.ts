import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-db';
import { canUserPerformAction } from '@/lib/access-control';
import { isSuperAdmin } from '@/lib/super-admin';
import { z } from 'zod';
import crypto from 'crypto';

const inviteUserSchema = z.object({
  email: z.string().email('Email invalide').optional(),
  phone: z.string().optional(),
  firstName: z.string().min(1, 'Le prénom est requis').optional(),
  lastName: z.string().min(1, 'Le nom est requis').optional(),
  role: z.enum(['owner', 'admin', 'accountant', 'agent', 'viewer']),
  profileId: z.string().uuid('Profil invalide').optional(),
  invitationMethod: z.enum(['email', 'sms', 'both']),
}).refine((data) => data.email || data.phone, {
  message: 'Email ou téléphone requis',
  path: ['email'],
});

/**
 * POST /api/organization/users/invite
 * Invite a new user to the organization using Supabase Auth
 */
export async function POST(request: NextRequest) {
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

    // Check permission to create users
    // Allow admin and owner roles to manage users, in addition to profile-based permissions
    const canCreateByProfile = await canUserPerformAction(userId, user.organizationId, 'User', 'create');
    const canCreateByRole = user.role === 'admin' || user.role === 'owner';
    const canCreate = canCreateByProfile || canCreateByRole;
    
    if (!canCreate) {
      return NextResponse.json(
        { error: 'You do not have permission to invite users' },
        { status: 403 }
      );
    }

    // Check plan user limits before creating invitation
    const subscriptions = await db.select<{
      plan_id: string;
      status: string;
    }>('subscriptions', {
      eq: { organization_id: organization.id },
      limit: 1,
    });

    const subscription = subscriptions[0];
    let usersLimit: number | null = null;

    if (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
      const planRecord = await db.selectOne<{
        users_limit: number | null;
      }>('plans', {
        eq: { id: subscription.plan_id },
      });

      if (planRecord) {
        usersLimit = planRecord.users_limit;
      }
    }

    // If no plan found, use freemium limits
    if (usersLimit === null) {
      const { getPlanLimits } = await import('@/lib/permissions');
      const limits = await getPlanLimits('freemium');
      usersLimit = limits.users;
    }

    // Count current active users
    const activeUsers = await db.select<{ id: string }>('users', {
      eq: { organization_id: organization.id, is_active: true },
    });

    const currentUserCount = activeUsers.length;

    // Check if adding one more user would exceed the limit
    // Note: usersLimit can be null (unlimited) or a number
    if (usersLimit !== null && usersLimit !== -1 && currentUserCount >= usersLimit) {
      return NextResponse.json(
        { 
          error: `Limite d'utilisateurs atteinte. Votre plan permet ${usersLimit} utilisateur${usersLimit > 1 ? 's' : ''}. Veuillez mettre à niveau votre plan pour inviter plus d'utilisateurs.`,
          limitReached: true,
          currentCount: currentUserCount,
          limit: usersLimit,
        },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = inviteUserSchema.parse(body);

    // Check if user already exists by email or phone
    if (validatedData.email) {
      const existingUser = await db.selectOne<{ id: string }>('users', {
        eq: { email: validatedData.email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Un utilisateur avec cet email existe déjà' },
          { status: 400 }
        );
      }

      // Check if user exists in Supabase Auth
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuthUser = authUsers?.users.find(u => u.email === validatedData.email);
      
      if (existingAuthUser) {
        // User exists in Supabase Auth but not in our database - create link
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
          id: existingAuthUser.id, // Use Supabase auth user ID as primary key
          sb_user_id: existingAuthUser.id,
          organization_id: organization.id,
          email: validatedData.email,
          phone: validatedData.phone || null,
          first_name: validatedData.firstName || null,
          last_name: validatedData.lastName || null,
          role: validatedData.role,
          profile_id: validatedData.profileId || null,
          is_active: true,
        });

        if (!newUser) {
          return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
          );
        }

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
          message: 'Utilisateur ajouté avec succès',
        });
      }
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation record
    const invitation = await db.insertOne<{
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
      invited_by: string | null;
      status: string;
      expires_at: Date;
      created_at: Date;
    }>('user_invitations', {
      organization_id: organization.id,
      email: validatedData.email || null,
      phone: validatedData.phone || null,
      first_name: validatedData.firstName || null,
      last_name: validatedData.lastName || null,
      role: validatedData.role,
      profile_id: validatedData.profileId || null,
      token,
      invitation_method: validatedData.invitationMethod,
      invited_by: userId,
      status: 'pending',
      expires_at: expiresAt,
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    // Create user in Supabase Auth (invite via email or phone)
    let authUser = null;
    let invitationUrl = '';

    if (validatedData.invitationMethod === 'email' || validatedData.invitationMethod === 'both') {
      if (!validatedData.email) {
        return NextResponse.json(
          { error: 'Email requis pour cette méthode d\'invitation' },
          { status: 400 }
        );
      }

      // Invite user via Supabase Auth
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        validatedData.email,
        {
          data: {
            organization_id: organization.id,
            organization_name: organization.name,
            role: validatedData.role,
            first_name: validatedData.firstName,
            last_name: validatedData.lastName,
            invitation_token: token,
          },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/accept-invitation?token=${token}`,
        }
      );

      if (inviteError) {
        console.error('Error inviting user via Supabase:', inviteError);
        // Continue even if Supabase invite fails - we have the invitation record
      } else if (inviteData?.user) {
        authUser = inviteData.user;
        
        // Create user record in database linked to Supabase auth user
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
          id: authUser.id, // Use Supabase auth user ID as primary key
          sb_user_id: authUser.id,
          organization_id: organization.id,
          email: validatedData.email,
          phone: validatedData.phone || null,
          first_name: validatedData.firstName || null,
          last_name: validatedData.lastName || null,
          role: validatedData.role,
          profile_id: validatedData.profileId || null,
          is_active: true,
        });

        if (newUser) {
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
            invitationUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/accept-invitation?token=${token}`,
            message: 'Invitation envoyée avec succès',
          });
        }
      }

      invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/accept-invitation?token=${token}`;
    }

    if (validatedData.invitationMethod === 'sms' || validatedData.invitationMethod === 'both') {
      if (!validatedData.phone) {
        return NextResponse.json(
          { error: 'Téléphone requis pour cette méthode d\'invitation' },
          { status: 400 }
        );
      }

      // For SMS, we'll need to implement SMS sending logic
      // For now, just create the invitation record
      invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/accept-invitation?token=${token}`;
    }

    // Update invitation with sent status
    await db.update('user_invitations', {
      sent_at: new Date(),
    }, {
      id: invitation.id,
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        phone: invitation.phone,
        token: invitation.token,
      },
      invitationUrl,
      message: 'Invitation créée avec succès',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating user invitation:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

