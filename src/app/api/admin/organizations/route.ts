import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { isGlobalAdmin } from '@/lib/global-admin';

// GET - List all organizations
export async function GET(request: Request) {
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

    // Check if user is super-admin or global admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);
    const userIsGlobalAdmin = await isGlobalAdmin(user.id);
    
    if (!userIsSuperAdmin && !userIsGlobalAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin or Global Administrator access required' },
        { status: 403 }
      );
    }

    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const plan = searchParams.get('plan');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Get all organizations (we'll filter by search in application for now)
    // Note: Supabase doesn't support ilike in filter, so we'll do client-side filtering
    const allOrganizations = await db.select<{
      id: string;
      name: string | null;
      slug: string | null;
      type: string | null;
      country: string;
      extranet_tenants_count: number;
      custom_extranet_domain: string | null;
      stripe_customer_id: string | null;
      is_configured: boolean;
      created_at: string;
      updated_at: string;
    }>('organizations', {
      orderBy: { column: 'created_at', ascending: false },
      limit: 1000, // Get more to filter client-side, then paginate
    });

    // Get active subscriptions for each organization to get plan info
    const organizationIds = allOrganizations.map((org) => org.id);
    
    // Get subscriptions for all organizations (active or trialing)
    let subscriptions: Array<{
      organization_id: string;
      plan_id: string;
      status: string;
    }> = [];
    
    if (organizationIds.length > 0) {
      // Get active subscriptions
      const activeSubs = await db.select<{
        organization_id: string;
        plan_id: string;
        status: string;
      }>('subscriptions', {
        in: { organization_id: organizationIds },
        filter: { status: 'active' },
      });
      
      // Get trialing subscriptions
      const trialingSubs = await db.select<{
        organization_id: string;
        plan_id: string;
        status: string;
      }>('subscriptions', {
        in: { organization_id: organizationIds },
        filter: { status: 'trialing' },
      });
      
      subscriptions = [...activeSubs, ...trialingSubs];
    }

    // Get plan names
    const planIds = [...new Set(subscriptions.map((s) => s.plan_id))];
    let plans: Array<{
      id: string;
      name: string;
      display_name: string;
    }> = [];
    
    if (planIds.length > 0) {
      plans = await db.select<{
        id: string;
        name: string;
        display_name: string;
      }>('plans', {
        in: { id: planIds },
      });
    }

    const planMap = new Map(plans.map((p) => [p.id, p]));

    // Get user counts for each organization
    // Note: We need to count for each org individually since db.count doesn't support GROUP BY
    const userCountMap = new Map<string, number>();
    if (organizationIds.length > 0) {
      // Use Promise.all for parallel counting (more efficient)
      const userCountPromises = organizationIds.map(async (orgId) => {
        const count = await db.count('users', {
          organization_id: orgId,
        });
        return [orgId, count] as [string, number];
      });
      const userCounts = await Promise.all(userCountPromises);
      userCounts.forEach(([orgId, count]) => {
        userCountMap.set(orgId, count);
      });
    }

    // Get unit counts for each organization
    const unitCountMap = new Map<string, number>();
    if (organizationIds.length > 0) {
      // Use Promise.all for parallel counting (more efficient)
      const unitCountPromises = organizationIds.map(async (orgId) => {
        const count = await db.count('units', {
          organization_id: orgId,
        });
        return [orgId, count] as [string, number];
      });
      const unitCounts = await Promise.all(unitCountPromises);
      unitCounts.forEach(([orgId, count]) => {
        unitCountMap.set(orgId, count);
      });
    }

    // Combine data
    let organizationsWithDetails = allOrganizations.map((org) => {
      const subscription = subscriptions.find((s) => s.organization_id === org.id);
      const planRecord = subscription ? planMap.get(subscription.plan_id) : null;

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type,
        country: org.country,
        plan: planRecord ? {
          id: planRecord.id,
          name: planRecord.name,
          displayName: planRecord.display_name,
        } : null,
        subscriptionStatus: subscription?.status || null,
        extranetTenantsCount: org.extranet_tenants_count,
        customExtranetDomain: org.custom_extranet_domain,
        // Hide sensitive billing data for Global Admin (not Super Admin)
        stripeCustomerId: userIsSuperAdmin ? org.stripe_customer_id : null,
        isConfigured: org.is_configured,
        userCount: userCountMap.get(org.id) || 0,
        unitCount: unitCountMap.get(org.id) || 0,
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      };
    });

    // Apply search filter if specified
    if (search) {
      const searchLower = search.toLowerCase();
      organizationsWithDetails = organizationsWithDetails.filter(
        (org) =>
          org.name?.toLowerCase().includes(searchLower) ||
          org.slug?.toLowerCase().includes(searchLower)
      );
    }

    // Apply plan filter if specified
    if (plan) {
      organizationsWithDetails = organizationsWithDetails.filter(
        (org) => org.plan?.name === plan
      );
    }

    // Get total count after filtering
    const totalCount = organizationsWithDetails.length;

    // Apply pagination
    const paginated = organizationsWithDetails.slice(offset, offset + limit);

    return NextResponse.json({
      organizations: paginated,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

