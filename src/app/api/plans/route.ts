import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

/**
 * GET /api/plans
 * Get all active plans from database
 * Uses the same logic as /api/public/pricing: fetch from plan_features, join with plans and features
 */
export async function GET() {
  try {
    // Step 1: Get all plan_features
    const { data: pfData, error: pfError } = await supabaseAdmin
      .from('plan_features')
      .select('*')
      .order('created_at', { ascending: true });

    if (pfError) {
      console.error('Error fetching plan features:', pfError);
      return NextResponse.json(
        { error: 'Failed to fetch plan features data' },
        { status: 500 }
      );
    }

    if (!pfData || pfData.length === 0) {
      console.log('No plan features found');
      return NextResponse.json({
        plans: [],
        count: 0,
      });
    }

    // Step 2: Get unique plan IDs and feature IDs
    const planIds = [...new Set(pfData.map((pf: any) => pf.plan_id))];
    const featureIds = [...new Set(pfData.map((pf: any) => pf.feature_id))];

    // Step 3: Fetch all active plans
    const { data: plansData, error: plansError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      return NextResponse.json(
        { error: 'Failed to fetch plans' },
        { status: 500 }
      );
    }

    // Step 4: Fetch all features
    const { data: featuresData, error: featuresError } = await supabaseAdmin
      .from('features')
      .select('*')
      .eq('is_active', true);

    if (featuresError) {
      console.error('Error fetching features:', featuresError);
      return NextResponse.json(
        { error: 'Failed to fetch features' },
        { status: 500 }
      );
    }

    // Step 5: Create lookup maps for efficient joining
    const plansMap = new Map((plansData || []).map((p: any) => [p.id, p]));
    const featuresMap = new Map((featuresData || []).map((f: any) => [f.id, f]));

    // Step 6: Combine plan_features with plan and feature details
    const planFeaturesWithDetails = pfData.map((pf: any) => ({
      ...pf,
      plan: plansMap.get(pf.plan_id) || null,
      feature: featuresMap.get(pf.feature_id) || null,
    }));

    // Step 7: Group by plan and build plans array
    const plansWithFeaturesMap = new Map<string, any>();

    planFeaturesWithDetails.forEach((pf: any) => {
      const plan = pf.plan;
      const feature = pf.feature;

      if (!plan) return;

      const planId = plan.id;

      if (!plansWithFeaturesMap.has(planId)) {
        // Calculate yearly price if yearly_discount_rate is set
        let yearlyPrice = plan.price_yearly ?? null;
        if (plan.yearly_discount_rate !== null && plan.yearly_discount_rate !== undefined) {
          if (plan.price_monthly !== null && plan.price_monthly !== undefined && plan.price_monthly > 0) {
            const discountMultiplier = 1 - (plan.yearly_discount_rate / 100);
            yearlyPrice = plan.price_monthly * 12 * discountMultiplier;
          }
        }

        // Use price_monthly as the base price
        const price = plan.price_monthly === null || plan.price_monthly === undefined 
          ? 'custom' 
          : plan.price_monthly;

        plansWithFeaturesMap.set(planId, {
          id: planId,
          name: plan.name,
          displayName: plan.display_name || plan.name,
          description: plan.description || null,
          price: price,
          priceYearly: yearlyPrice,
          yearlyDiscountRate: plan.yearly_discount_rate || null,
          priceType: price === 'custom' ? 'custom' : 'fixed',
          // Use exact field names from Plans table
          max_properties: plan.max_properties === -1 ? null : plan.max_properties,
          max_units: plan.max_units === -1 ? null : plan.max_units, // max_units is for lots
          extranet_tenants_limit: plan.extranet_tenants_limit === -1 ? null : plan.extranet_tenants_limit,
          max_users: plan.max_users === -1 ? null : plan.max_users,
          // Include compatibility aliases for backward compatibility
          lots_limit: plan.max_units === -1 ? null : plan.max_units, // Use max_units for lots
          users_limit: plan.max_users === -1 ? null : plan.max_users,
          // Additional aliases for subscription page
          lotsLimit: plan.max_units === -1 ? null : plan.max_units,
          usersLimit: plan.max_users === -1 ? null : plan.max_users,
          extranetTenantsLimit: plan.extranet_tenants_limit === -1 ? null : plan.extranet_tenants_limit,
          features: {}, // Features object for compatibility
          limits: {
            lots: plan.max_units === -1 ? null : plan.max_units, // Use max_units for lots
            units: plan.max_units === -1 ? null : plan.max_units,
            users: plan.max_users === -1 ? null : plan.max_users,
            extranetTenants: plan.extranet_tenants_limit === -1 ? null : plan.extranet_tenants_limit,
          },
          isActive: true,
        });
      }

      const planData = plansWithFeaturesMap.get(planId)!;

      // Add enabled features to features object
      if (pf.is_enabled && feature) {
        // Map feature name to a key for the features object
        const featureKey = feature.name.toLowerCase().replace(/\s+/g, '_');
        planData.features[featureKey] = true;
      }
    });

    // Convert map to array
    const plansWithFeatures = Array.from(plansWithFeaturesMap.values());

    return NextResponse.json({
      plans: plansWithFeatures,
      count: plansWithFeatures.length,
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
