import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { users, userInvitations, tenants, properties, units } from '@/db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/organization/users/activities
 * Get recent activities related to users management
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

    // Get recent user invitations
    const recentInvitations = await db
      .select({
        id: userInvitations.id,
        email: userInvitations.email,
        firstName: userInvitations.firstName,
        lastName: userInvitations.lastName,
        role: userInvitations.role,
        status: userInvitations.status,
        createdAt: userInvitations.createdAt,
        invitedBy: userInvitations.invitedBy,
        inviterFirstName: users.firstName,
        inviterLastName: users.lastName,
      })
      .from(userInvitations)
      .leftJoin(users, eq(userInvitations.invitedBy, users.id))
      .where(
        and(
          eq(userInvitations.organizationId, user.organizationId),
          or(
            eq(userInvitations.status, 'pending'),
            eq(userInvitations.status, 'accepted')
          )!
        )
      )
      .orderBy(desc(userInvitations.createdAt))
      .limit(10);

    // Get recent user creations (from last 7 days)
    const recentUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          eq(users.organizationId, user.organizationId),
          sql`${users.createdAt} >= NOW() - INTERVAL '7 days'`
        )
      )
      .orderBy(desc(users.createdAt))
      .limit(10);

    // Format activities
    const activities = [
      ...recentInvitations.map(inv => ({
        id: inv.id,
        type: inv.status === 'accepted' ? 'user_joined' : 'user_invited',
        user: {
          id: inv.invitedBy,
          firstName: inv.inviterFirstName,
          lastName: inv.inviterLastName,
        },
        target: {
          email: inv.email,
          firstName: inv.firstName,
          lastName: inv.lastName,
          role: inv.role,
        },
        description: inv.status === 'accepted'
          ? `${inv.inviterFirstName} ${inv.inviterLastName} a rejoint l'organisation`
          : `${inv.inviterFirstName} ${inv.inviterLastName} a invité ${inv.firstName} ${inv.lastName} à rejoindre l'organisation`,
        createdAt: inv.createdAt,
      })),
      ...recentUsers.map(u => ({
        id: u.id,
        type: 'user_created',
        user: {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
        },
        target: null,
        description: `${u.firstName} ${u.lastName} a créé un compte`,
        createdAt: u.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching user activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

