import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPlanLimitsFromDB, getPlanFromDB } from '@/lib/plans-db';
import { getPlanLimits, getPlanDefinition, type PlanName } from '@/lib/permissions';
import { getAllPlanFeaturesWithStatus } from '@/lib/plan-features';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';

export async function GET() {
  try {
    const { userId } = await checkAuth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user and organization using Supabase
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is super admin - super admins have unlimited access
    const userIsSuperAdmin = await isSuperAdmin(user.id);
    
    if (userIsSuperAdmin) {
      // Super admin: unlimited access, all features enabled
      return NextResponse.json({
        plan: 'enterprise' as PlanName,
        limits: {
          lots: -1, // Unlimited
          users: -1, // Unlimited
          extranetTenants: -1, // Unlimited
        },
        definition: {
          name: 'enterprise',
          price: 0,
          lots_limit: null, // Unlimited
          users_limit: null, // Unlimited
          extranet_tenants_limit: null, // Unlimited
          features: {}, // All features enabled
        },
        enabledFeatures: [], // All features (empty array means all enabled)
        userRole: user.role || 'admin',
        currentUsage: {
          lots: 0,
          users: 0,
          extranetTenants: 0,
        },
        organization: user.organizationId ? {
          id: user.organizationId,
          name: null,
          customExtranetDomain: null,
        } : null,
      });
    }

    // If user has no organization, return default freemium plan
    if (!user.organizationId) {
      const plan: PlanName = 'freemium';
      const limits = await getPlanLimitsFromDB(plan);
      const definition = await getPlanFromDB(plan);
      
      return NextResponse.json({
        plan,
        limits: limits || {
          lots: 5,
          users: 1,
          extranetTenants: 5,
        },
        definition: definition || {
          name: plan,
          price: 0,
          lots_limit: 5,
          users_limit: 1,
          extranet_tenants_limit: 5,
          features: {},
        },
        enabledFeatures: [],
        userRole: user.role || 'viewer',
        currentUsage: {
          lots: 0,
          users: 0,
          extranetTenants: 0,
        },
        organization: null,
      });
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get plan from active subscription
    // First, try to get an active subscription
    let subscriptionRecords = await db.select<{
      plan_id: string;
      status: string;
    }>('subscriptions', {
      eq: { 
        organization_id: organization.id,
        status: 'active',
      },
      orderBy: { column: 'created_at', ascending: false },
      limit: 1,
    });
    let subscriptionRecord = subscriptionRecords[0] || null;

    // If no active subscription, try trialing
    if (!subscriptionRecord) {
      subscriptionRecords = await db.select<{
        plan_id: string;
        status: string;
      }>('subscriptions', {
        eq: { 
          organization_id: organization.id,
          status: 'trialing',
        },
        orderBy: { column: 'created_at', ascending: false },
        limit: 1,
      });
      subscriptionRecord = subscriptionRecords[0] || null;
    }

    // If still no subscription, get the most recent one (fallback)
    if (!subscriptionRecord) {
      const subscriptionRecords = await db.select<{
        plan_id: string;
        status: string;
      }>('subscriptions', {
        eq: { organization_id: organization.id },
        orderBy: { column: 'created_at', ascending: false },
        limit: 1,
      });
      subscriptionRecord = subscriptionRecords[0];
    }

    let plan: PlanName = 'freemium';
    if (subscriptionRecord?.plan_id) {
      const planRecord = await db.selectOne<{
        name: string;
      }>('plans', {
        eq: { id: subscriptionRecord.plan_id },
      });
      
      if (planRecord?.name) {
        plan = planRecord.name as PlanName;
      }
    }

    // Get current usage counts
    const lotsCount = await db.count('units', {
      organization_id: organization.id,
    });

    const usersCount = await db.count('users', {
      organization_id: organization.id,
    });

    const extranetTenantsCount = await db.count('tenants', {
      organization_id: organization.id,
      has_extranet_access: true,
    });

    // Get plan from database - ensure we get real data
    const limits = await getPlanLimitsFromDB(plan);
    const definition = await getPlanFromDB(plan);
    
    // Log for debugging
    console.log('[Plan API] Plan:', plan);
    console.log('[Plan API] Limits from DB:', JSON.stringify(limits, null, 2));
    console.log('[Plan API] Definition from DB:', definition ? {
      name: definition.name,
      extranet_tenants_limit: definition.extranet_tenants_limit,
    } : 'null');
    
    // Ensure limits are valid - if extranetTenants is undefined, use fallback
    if (!limits || typeof limits.extranetTenants === 'undefined' || limits.extranetTenants === null) {
      console.error('[Plan API] Invalid limits, using fallback. Limits object:', limits);
      // Fallback to default if limits are invalid
      const fallbackLimits = {
        lots: 5,
        users: 1,
        extranetTenants: 5,
      };
      return NextResponse.json({
        plan,
        limits: fallbackLimits,
        definition: definition || {
          name: plan,
          price: 0,
          lots_limit: 5,
          users_limit: 1,
          extranet_tenants_limit: 5,
          features: {},
        },
        enabledFeatures: [],
        userRole: user?.role || 'viewer',
        currentUsage: {
          lots: lotsCount || 0,
          users: usersCount || 0,
          extranetTenants: extranetTenantsCount || 0,
        },
        organization: {
          id: organization.id,
          name: organization.name,
          customExtranetDomain: organization.customExtranetDomain || null,
        },
      });
    }

    // Get enabled features for this plan from database
    const planFeatures = await getAllPlanFeaturesWithStatus(plan);
    const enabledFeatures = planFeatures
      .filter(f => f.isEnabled)
      .map(f => f.key);
    
    // Get user role for permissions (user already defined above)
    const userRole = user?.role || 'viewer';

    return NextResponse.json({
      plan,
      limits,
      definition,
      enabledFeatures, // Features enabled for this plan
      userRole, // Current user's role
      currentUsage: {
        lots: lotsCount || 0,
        users: usersCount || 0,
        extranetTenants: extranetTenantsCount || 0,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        customExtranetDomain: organization.customExtranetDomain || null,
      },
    });
  } catch (error) {
    console.error('Error fetching organization plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

