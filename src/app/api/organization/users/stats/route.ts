import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';

/**
 * GET /api/organization/users/stats
 * Get statistics for users management page
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

    // Get plan limits
    const subscriptionRecords = await db.select<{
      plan_id: string;
    }>('subscriptions', {
      eq: { organization_id: organization.id },
      orderBy: { column: 'created_at', ascending: true },
      limit: 1,
    });

    let usersLimit = 1;
    let extranetTenantsLimit = 5;
    let planName = 'freemium';

    if (subscriptionRecords[0]?.plan_id) {
      const plan = await db.selectOne<{
        users_limit: number | null;
        extranet_tenants_limit: number | null;
        name: string;
      }>('plans', {
        eq: { id: subscriptionRecords[0].plan_id },
      });
      
      if (plan) {
        usersLimit = plan.users_limit || 1;
        extranetTenantsLimit = plan.extranet_tenants_limit || 5;
        planName = plan.name || 'freemium';
      }
    }

    // Count active users
    const usersCount = await db.count('users', {
      organization_id: user.organizationId,
      is_active: true,
    });

    // Count extranet tenants (tenants with extranet access)
    const extranetTenantsCount = await db.count('tenants', {
      organization_id: user.organizationId,
      has_extranet_access: true,
    });

    // Get users by role - need to use a custom query for grouping
    const allUsers = await db.select<{
      role: string;
    }>('users', {
      eq: { 
        organization_id: user.organizationId,
        is_active: true,
      },
    });

    const roleCounts: Record<string, number> = {};
    allUsers.forEach((user) => {
      const role = user.role || 'viewer';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });

    // Get custom extranet domain if exists
    const customDomain = organization.custom_extranet_domain || null;

    return NextResponse.json({
      plan: {
        name: planName,
        usersLimit: usersLimit === -1 ? null : usersLimit,
        extranetTenantsLimit: extranetTenantsLimit === -1 ? null : extranetTenantsLimit,
        customDomain,
      },
      stats: {
        activeUsers: usersCount || 0,
        extranetTenants: extranetTenantsCount || 0,
        roleCounts,
      },
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

