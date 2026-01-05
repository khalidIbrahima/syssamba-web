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
      yearly_discount_rate: number | null;
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
        // If limit is null, undefined, or -1, it means unlimited
        const lotsLimit = plan.lots_limit === null || plan.lots_limit === undefined || plan.lots_limit === -1 
          ? 'Illimité' 
          : plan.lots_limit.toString();
        featureItems.push({
          text: `Lots: ${lotsLimit}`,
          included: true,
        });
        
        const usersLimit = plan.users_limit === null || plan.users_limit === undefined || plan.users_limit === -1 
          ? 'Illimité' 
          : plan.users_limit.toString();
        featureItems.push({
          text: `Utilisateurs: ${usersLimit}`,
          included: true,
        });
        
        const extranetLimit = plan.extranet_tenants_limit === null || plan.extranet_tenants_limit === undefined || plan.extranet_tenants_limit === -1 
          ? 'Illimité' 
          : plan.extranet_tenants_limit.toString();
        featureItems.push({
          text: `Intranet locataires: ${extranetLimit}`,
          included: true,
        });

        // Add enabled features (only show enabled features on pricing page)
        featuresList.forEach(feature => {
          featureItems.push({
            text: feature.name,
            included: true,
          });
        });

        // Calculate yearly price if yearly_discount_rate is set and yearly price is not already set
        let yearlyPrice = planData?.price_yearly ?? null;
        
        if (planData && planData.yearly_discount_rate !== null && planData.yearly_discount_rate !== undefined) {
          // If yearly_discount_rate is set, calculate yearly price from monthly price
          if (planData.price_monthly !== null && planData.price_monthly !== undefined && planData.price_monthly > 0) {
            // Formula: yearly_price = monthly_price * 12 * (1 - discount_rate/100)
            const discountMultiplier = 1 - (planData.yearly_discount_rate / 100);
            yearlyPrice = planData.price_monthly * 12 * discountMultiplier;
          }
        }
        
        const prices = planData ? {
          monthly: planData.price_monthly,
          yearly: yearlyPrice,
        } : { monthly: null, yearly: null };

        return {
          id: planIdMap.get(plan.name) || '',
          name: plan.name,
          displayName: plan.display_name || plan.name,
          description: planData?.description || plan.display_name || '',
          priceMonthly: prices.monthly !== null && prices.monthly !== undefined 
            ? Math.round(prices.monthly).toString() 
            : (prices.monthly === null ? 'Sur devis' : '0'),
          priceYearly: prices.yearly !== null && prices.yearly !== undefined 
            ? Math.round(prices.yearly).toString() 
            : (prices.yearly === null ? 'Sur devis' : '0'),
          priceType: prices.monthly === null || prices.monthly === undefined ? 'custom' : 'fixed',
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

