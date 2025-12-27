import { NextResponse } from 'next/server';
import { getAllPlansFromDB } from '@/lib/plans-db';
import { getEnabledPlanFeatures } from '@/lib/plan-features';

/**
 * GET /api/plans
 * Get all active plans from database
 */
export async function GET() {
  try {
    const plans = await getAllPlansFromDB();

    // Also get IDs for each plan from Supabase
    const { db } = await import('@/lib/db');
    const planRecords = await db.select<{
      id: string;
      name: string;
    }>('plans', {
      filter: { is_active: true },
    });

    const planIdMap = new Map(planRecords.map((p) => [p.name, p.id]));

    // Get features for each plan from plan_features table
    const plansWithFeatures = await Promise.all(
      plans.map(async (plan) => {
        // Get enabled features for this plan
        const enabledFeatures = await getEnabledPlanFeatures(plan.name as any);
        
        // Convert Set to object for compatibility
        const featuresObj: Record<string, boolean> = {};
        enabledFeatures.forEach(key => {
          featuresObj[key] = true;
        });

        return {
          id: planIdMap.get(plan.name) || '',
          name: plan.name,
          displayName: plan.display_name || plan.name,
          price: plan.price, // Already converted from price_monthly in getAllPlansFromDB
          priceType: typeof plan.price === 'string' && plan.price === 'custom' ? 'custom' : 'fixed',
          // Include both naming conventions for compatibility
          lots_limit: plan.lots_limit,
          users_limit: plan.users_limit,
          extranet_tenants_limit: plan.extranet_tenants_limit,
          // Also include original field names from Supabase
          max_properties: plan.lots_limit,
          max_users: plan.users_limit,
          max_tenants: plan.extranet_tenants_limit,
          features: featuresObj, // Features from plan_features table
          limits: {
            lots: plan.lots_limit,
            users: plan.users_limit,
            extranetTenants: plan.extranet_tenants_limit,
          },
          isActive: true,
        };
      })
    );

    return NextResponse.json({
      plans: plansWithFeatures,
      count: plans.length,
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
