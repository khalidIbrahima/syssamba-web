import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db';
import { getPlanLimits, getPlanDefinition } from '@/lib/permissions';

/**
 * GET /api/organization/plan
 * Get current user's organization plan and usage information
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

    if (!user.organizationId) {
      // Return freemium plan for users without organization
      const planName = 'freemium';
      const limits = await getPlanLimits(planName);
      const definition = await getPlanDefinition(planName);

      return NextResponse.json({
        plan: planName,
        limits,
        definition,
        currentUsage: {
          lots: 0,
          users: 1, // Current user counts as 1
          extranetTenants: 0,
        },
      });
    }

    // Get active subscription for the organization
    const subscriptions = await db.select<{
      plan_id: string;
      status: string;
    }>('subscriptions', {
      eq: { organization_id: user.organizationId },
      limit: 1,
    });

    const subscription = subscriptions[0];

    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
      // No active subscription, use freemium
      const planName = 'freemium';
      const limits = await getPlanLimits(planName);
      const definition = await getPlanDefinition(planName);

      return NextResponse.json({
        plan: planName,
        limits,
        definition,
        currentUsage: {
          lots: 0, // Will be calculated by the hook if needed
          users: 0,
          extranetTenants: 0,
        },
      });
    }

    // Get plan details directly from Supabase with correct field names
    const { data: planRecord, error: planError } = await supabaseAdmin
      .from('plans')
      .select('id, name, display_name, max_units, max_users, extranet_tenants_limit')
      .eq('id', subscription.plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !planRecord) {
      // Plan not found, fallback to freemium
      const planName = 'freemium';
      const limits = await getPlanLimits(planName);
      const definition = await getPlanDefinition(planName);

      return NextResponse.json({
        plan: planName,
        limits,
        definition,
        currentUsage: {
          lots: 0,
          users: 0,
          extranetTenants: 0,
        },
      });
    }

    // Convert plan record to PlanName type
    const planName = planRecord.name as any; // We'll trust the database has valid plan names
    
    // Build limits from database fields (max_units for lots)
    const limits = {
      lots: planRecord.max_units === -1 || planRecord.max_units === null ? -1 : planRecord.max_units,
      users: planRecord.max_users === -1 || planRecord.max_users === null ? -1 : planRecord.max_users,
      extranetTenants: planRecord.extranet_tenants_limit === -1 || planRecord.extranet_tenants_limit === null ? -1 : planRecord.extranet_tenants_limit,
    };
    
    // Get definition for additional plan info
    const definition = await getPlanDefinition(planName);
    
    // Override display_name with the one from database if available
    if (planRecord.display_name) {
      definition.display_name = planRecord.display_name;
    }

    // Get current usage (this could be optimized with actual counts)
    // For now, return zeros - the hook can fetch detailed usage if needed
    const currentUsage = {
      lots: 0,
      users: 0,
      extranetTenants: 0,
    };

    return NextResponse.json({
      plan: planName,
      limits,
      definition,
      currentUsage,
    });

  } catch (error) {
    console.error('Error fetching organization plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
