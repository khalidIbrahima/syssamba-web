import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db, supabaseAdmin } from '@/lib/db';

/**
 * GET /api/admin/statistics
 * Get global statistics for super admin dashboard
 * Only accessible by super admins
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
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is super admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);
    
    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    // Get all organizations count
    const totalOrganizations = await db.count('organizations');
    
    // Get organizations by type
    const allOrganizations = await db.select<{
      type: string | null;
    }>('organizations', {});

    const orgTypesCount: Record<string, number> = {};
    allOrganizations.forEach((org: any) => {
      const type = org.type || 'individual';
      orgTypesCount[type] = (orgTypesCount[type] || 0) + 1;
    });

    // Get total users count (exclude super admins)
    const allUsers = await db.select<{
      is_super_admin: boolean;
    }>('users', {});
    const totalUsers = allUsers.filter((u: any) => !u.is_super_admin).length;

    // Get total properties count
    const totalProperties = await db.count('properties');

    // Get total units count
    const totalUnits = await db.count('units');

    // Get total tenants count
    const totalTenants = await db.count('tenants');

    // Get active subscriptions count
    const activeSubscriptions = await db.select<{
      id: string;
      status: string;
      plan_id: string;
      organization_id: string;
    }>('subscriptions', {
      eq: { status: 'active' },
    });

    const activeSubscriptionsCount = activeSubscriptions.length;

    // Get subscriptions by plan
    const subscriptionsByPlanData = activeSubscriptions;

    // Get plan names
    const planIds = [...new Set(subscriptionsByPlanData.map((s: any) => s.plan_id).filter(Boolean))];
    const plans = await Promise.all(
      planIds.map(async (planId) => {
        const plan = await db.selectOne<{
          id: string;
          name: string;
          display_name: string;
        }>('plans', {
          eq: { id: planId },
        });
        return plan;
      })
    );

    const subscriptionsByPlanName: Record<string, number> = {};
    subscriptionsByPlanData.forEach((sub: any) => {
      const plan = plans.find(p => p?.id === sub.plan_id);
      const planName = plan?.display_name || plan?.name || 'Unknown';
      subscriptionsByPlanName[planName] = (subscriptionsByPlanName[planName] || 0) + 1;
    });

    // Get total revenue (from subscription_payments where status = 'completed')
    const completedPayments = await db.select<{
      amount: string;
      currency: string;
    }>('subscription_payments', {
      eq: { status: 'completed' },
    });

    const totalRevenue = completedPayments.reduce((sum: number, payment: any) => {
      const amount = parseFloat(payment.amount || '0');
      return sum + amount;
    }, 0);

    // Get monthly revenue (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentPayments = await db.select<{
      amount: string;
      paid_at: string | null;
    }>('subscription_payments', {
      eq: { status: 'completed' },
    });

    const monthlyRevenue = recentPayments
      .filter((payment: any) => {
        if (!payment.paid_at) return false;
        const paidAt = new Date(payment.paid_at);
        return paidAt >= thirtyDaysAgo;
      })
      .reduce((sum: number, payment: any) => {
        const amount = parseFloat(payment.amount || '0');
        return sum + amount;
      }, 0);

    // Get recent organizations (last 30 days)
    const recentOrganizations = await db.select<{
      id: string;
      name: string;
      created_at: string;
    }>('organizations', {});

    const newOrganizationsThisMonth = recentOrganizations.filter((org: any) => {
      const createdAt = new Date(org.created_at);
      return createdAt >= thirtyDaysAgo;
    }).length;

    // Get organizations with active subscriptions
    const activeSubsWithOrgId = await db.select<{
      organization_id: string;
    }>('subscriptions', {
      eq: { status: 'active' },
    });
    const orgsWithActiveSubs = new Set(activeSubsWithOrgId.map((s: any) => s.organization_id || '').filter(Boolean));
    
    // Get organizations without subscriptions (on freemium)
    const freemiumOrganizations = totalOrganizations - orgsWithActiveSubs.size;

    // Get total extranet tenants
    const totalExtranetTenants = await db.select<{
      has_extranet_access: boolean;
    }>('tenants', {});

    const extranetTenantsCount = totalExtranetTenants.filter((t: any) => t.has_extranet_access).length;

    // Calculate growth rate (new orgs this month vs last month)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const orgsLastMonth = recentOrganizations.filter((org: any) => {
      const createdAt = new Date(org.created_at);
      return createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
    }).length;

    const growthRate = orgsLastMonth > 0 
      ? ((newOrganizationsThisMonth - orgsLastMonth) / orgsLastMonth) * 100 
      : (newOrganizationsThisMonth > 0 ? 100 : 0);

    return NextResponse.json({
      overview: {
        totalOrganizations,
        totalUsers,
        totalProperties,
        totalUnits,
        totalTenants,
        extranetTenantsCount,
        activeSubscriptions: activeSubscriptionsCount,
        freemiumOrganizations,
        totalRevenue,
        monthlyRevenue,
        newOrganizationsThisMonth,
        growthRate: Math.round(growthRate * 10) / 10,
      },
      organizationsByType: orgTypesCount,
      subscriptionsByPlan: subscriptionsByPlanName,
    });
  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

