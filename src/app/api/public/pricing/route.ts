import { NextResponse } from 'next/server';
import { getAllPlansFromDB } from '@/lib/plans-db';
import { getEnabledPlanFeatures } from '@/lib/plan-features';
import { getAllFeatures } from '@/lib/plan-features';

/**
 * GET /api/public/pricing
 * Public endpoint to get all plans with features for pricing page
 */
export async function GET() {
  try {
    const plans = await getAllPlansFromDB();
    const allFeatures = await getAllFeatures();

    // Create a map of feature keys to display names
    const featureMap = new Map(
      allFeatures.map(f => [f.key, f.name])
    );

    // Get full plan records from Supabase
    const { db } = await import('@/lib/db');
    const planRecords = await db.select<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      price_monthly: number | null;
      price_yearly: number | null;
      sort_order: number | null;
    }>('plans', {
      filter: { is_active: true },
      orderBy: { column: 'sort_order', ascending: true },
    });

    const planIdMap = new Map(planRecords.map((p) => [p.name, p.id]));
    const planDataMap = new Map(planRecords.map((p) => [p.name, p]));

    // Get features for each plan from plan_features table
    const plansWithFeatures = await Promise.all(
      plans.map(async (plan) => {
        const planData = planDataMap.get(plan.name);
        
        // Get enabled features for this plan
        const enabledFeatures = await getEnabledPlanFeatures(plan.name as any);
        
        // Convert enabled features to array with display names
        const featuresList = Array.from(enabledFeatures).map(featureKey => ({
          key: featureKey,
          name: featureMap.get(featureKey) || featureKey,
          included: true,
        }));

        // Build feature list with limits first, then enabled features
        const featureItems: Array<{ text: string; included: boolean }> = [];
        
        // Add limits as features
        if (plan.lots_limit !== null && plan.lots_limit !== undefined) {
          featureItems.push({
            text: `Lots: ${plan.lots_limit === -1 ? 'Illimité' : plan.lots_limit}`,
            included: true,
          });
        }
        
        if (plan.users_limit !== null && plan.users_limit !== undefined) {
          featureItems.push({
            text: `Utilisateurs: ${plan.users_limit === -1 ? 'Illimité' : plan.users_limit}`,
            included: true,
          });
        }
        
        if (plan.extranet_tenants_limit !== null && plan.extranet_tenants_limit !== undefined) {
          featureItems.push({
            text: `Intranet locataires: ${plan.extranet_tenants_limit === -1 ? 'Illimité' : plan.extranet_tenants_limit}`,
            included: true,
          });
        }

        // Add enabled features (only show enabled features on pricing page)
        featuresList.forEach(feature => {
          featureItems.push({
            text: feature.name,
            included: true,
          });
        });

        const prices = planData ? {
          monthly: planData.price_monthly,
          yearly: planData.price_yearly,
        } : { monthly: null, yearly: null };

        return {
          id: planIdMap.get(plan.name) || '',
          name: plan.name,
          displayName: plan.display_name || plan.name,
          description: planData?.description || plan.display_name || '',
          priceMonthly: prices.monthly !== null ? Math.round(prices.monthly).toString() : '0',
          priceYearly: prices.yearly !== null ? Math.round(prices.yearly).toString() : '0',
          priceType: prices.monthly === null ? 'custom' : 'fixed',
          features: featureItems,
          limits: {
            lots: plan.lots_limit,
            users: plan.users_limit,
            extranetTenants: plan.extranet_tenants_limit,
          },
          isActive: true,
          popular: plan.name === 'agency' || plan.name === 'agence', // Mark agency plan as popular
        };
      })
    );

    return NextResponse.json({
      plans: plansWithFeatures,
      count: plansWithFeatures.length,
    });
  } catch (error) {
    console.error('Error fetching pricing plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

