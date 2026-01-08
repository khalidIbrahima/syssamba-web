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

    // Count extranet tenants (from tenants table with has_extranet_access = true)
    const extranetTenants = await db.select<{ id: string }>('tenants', {
      eq: { organization_id: organization.id, has_extranet_access: true },
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

    // Get commissions for current month (from payments)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthlyPayments = await db.select<{
      amount: string;
      fee_amount: string;
      created_at: Date | string;
    }>('payments', {
      eq: { organization_id: organization.id, status: 'completed' },
    });

    // Filter payments for current month and calculate commissions
    const currentMonthPayments = monthlyPayments.filter((p: any) => {
      const paymentDate = p.created_at instanceof Date ? p.created_at : new Date(p.created_at);
      return paymentDate >= startOfMonth && paymentDate <= endOfMonth;
    });

    const currentMonthCommissions = currentMonthPayments.reduce((sum: number, p: any) => {
      const fee = parseFloat(p.fee_amount || '0');
      return sum + fee;
    }, 0);

    // Get previous month for comparison
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const prevMonthPayments = monthlyPayments.filter((p: any) => {
      const paymentDate = p.created_at instanceof Date ? p.created_at : new Date(p.created_at);
      return paymentDate >= prevMonthStart && paymentDate <= prevMonthEnd;
    });

    const prevMonthCommissions = prevMonthPayments.reduce((sum: number, p: any) => {
      const fee = parseFloat(p.fee_amount || '0');
      return sum + fee;
    }, 0);

    const commissionChange = prevMonthCommissions > 0 
      ? ((currentMonthCommissions - prevMonthCommissions) / prevMonthCommissions) * 100 
      : 0;

    // Count messages processed (messages with read_at set)
    const messages = await db.select<{
      id: string;
      read_at: Date | string | null;
      created_at: Date | string;
    }>('messages', {
      eq: { organization_id: organization.id },
    });

    const processedMessages = messages.filter((m: any) => m.read_at !== null).length;
    
    // Calculate average response time (time between message creation and read_at)
    const messagesWithResponseTime = messages
      .filter((m: any) => m.read_at !== null)
      .map((m: any) => {
        const createdAt = m.created_at instanceof Date ? m.created_at : new Date(m.created_at);
        const readAt = m.read_at instanceof Date ? m.read_at : new Date(m.read_at);
        return (readAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60); // hours
      });

    const avgResponseTime = messagesWithResponseTime.length > 0
      ? messagesWithResponseTime.reduce((sum, time) => sum + time, 0) / messagesWithResponseTime.length
      : 0;

    return NextResponse.json({
      stats: {
        activeUsers: activeUsersCount,
        extranetTenants: extranetTenantsCount,
        roleCounts,
        monthlyCommissions: Math.round(currentMonthCommissions),
        commissionChange: Math.round(commissionChange),
        processedMessages: processedMessages,
        avgResponseTimeHours: Math.round(avgResponseTime * 10) / 10,
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

