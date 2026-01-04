import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getPlanLimits, type PlanName } from '@/lib/permissions';

/**
 * GET /api/organization/users/stats
 * Get user statistics and plan limits for the current organization
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

    // Get active subscription for the organization
    const subscriptions = await db.select<{
      plan_id: string;
      status: string;
    }>('subscriptions', {
      eq: { organization_id: organization.id },
      limit: 1,
    });

    const subscription = subscriptions[0];

    let planName = 'freemium';
    let usersLimit: number | null = null;
    let extranetTenantsLimit: number | null = null;

    if (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
      // Get plan details
      const planRecord = await db.selectOne<{
        id: string;
        name: string;
        users_limit: number | null;
        extranet_tenants_limit: number | null;
      }>('plans', {
        eq: { id: subscription.plan_id },
      });

      if (planRecord) {
        planName = planRecord.name;
        usersLimit = planRecord.users_limit;
        extranetTenantsLimit = planRecord.extranet_tenants_limit;
      }
    }

    // If no plan found, use freemium limits
    if (!usersLimit && !extranetTenantsLimit) {
      const limits = await getPlanLimits(planName as PlanName);
      usersLimit = limits.users;
      extranetTenantsLimit = limits.extranetTenants;
    }

    // Count active users in the organization
    const activeUsers = await db.select<{ id: string }>('users', {
      eq: { organization_id: organization.id, is_active: true },
    });

    const activeUsersCount = activeUsers.length;

    // Count extranet tenants (users with role 'tenant' or similar)
    // This is a placeholder - adjust based on your actual tenant identification logic
    const extranetTenants = await db.select<{ id: string }>('users', {
      eq: { organization_id: organization.id, is_active: true },
      // Add tenant filtering logic here if needed
    });

    const extranetTenantsCount = extranetTenants.length;

    // Count users by role
    const usersByRole = await db.select<{
      role: string;
      count: number;
    }>('users', {
      eq: { organization_id: organization.id },
    });

    const roleCounts: Record<string, number> = {};
    usersByRole.forEach((u: any) => {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
    });

    return NextResponse.json({
      stats: {
        activeUsers: activeUsersCount,
        extranetTenants: extranetTenantsCount,
        roleCounts,
      },
      plan: {
        name: planName,
        usersLimit,
        extranetTenantsLimit,
        customDomain: null, // Add if needed
      },
    });
  } catch (error: any) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

