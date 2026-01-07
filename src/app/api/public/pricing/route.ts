import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

/**
 * GET /api/public/pricing
 * Public endpoint to get all plans with features for pricing page
 * Uses the same logic as /admin/plan-features: fetch from plan_features, join with plans and features, group by plan
 */
export async function GET(request: NextRequest) {
  try {
    // Get locale from URL path (e.g., /en/pricing or /fr/pricing)
    // Default to 'fr' if not found
    const pathname = request.nextUrl.pathname;
    const localeMatch = pathname.match(/^\/(en|fr)\//);
    const locale = localeMatch ? localeMatch[1] : 'fr';

    // Step 1: Get all plan_features (same approach as /admin/plan-features)
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

    // Step 2: Get unique plan IDs and feature IDs (same as /admin/plan-features)
    const planIds = [...new Set(pfData.map((pf: any) => pf.plan_id))];
    const featureIds = [...new Set(pfData.map((pf: any) => pf.feature_id))];

    // Step 3: Fetch all active plans (same as /admin/plan-features)
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

    // Step 4: Fetch all features (same as /admin/plan-features)
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

    // Step 5: Create lookup maps for efficient joining (same as /admin/plan-features)
    const plansMap = new Map((plansData || []).map((p: any) => [p.id, p]));
    const featuresMap = new Map((featuresData || []).map((f: any) => [f.id, f]));

    // Step 6: Combine plan_features with plan and feature details (same as /admin/plan-features)
    const planFeaturesWithDetails = pfData.map((pf: any) => ({
      ...pf,
      plan: plansMap.get(pf.plan_id) || null,
      feature: featuresMap.get(pf.feature_id) || null,
    }));

    // Step 7: Group by plan (same logic as /admin/plan-features)
    const plansWithFeaturesMap = new Map<string, {
      id: string;
      name: string;
      displayName: string;
      description: string | null;
      priceMonthly: number | null;
      priceYearly: number | null;
      priceType: 'fixed' | 'custom';
      maxUsers: number | null;
      features: Array<{
        text: string;
        included: boolean;
        category?: string;
      }>;
      limits: {
        lots: number | null;
        users: number | null;
        extranetTenants: number | null;
      };
      isActive: boolean;
      popular: boolean;
    }>();

    planFeaturesWithDetails.forEach((pf: any) => {
      const plan = pf.plan;
      const feature = pf.feature;

      if (!plan || !feature) return;

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

        const prices = {
          monthly: plan.price_monthly,
          yearly: yearlyPrice,
        };

        // Use translated fields based on locale
        const displayName = locale === 'en' 
          ? (plan.display_name_en || plan.display_name || plan.name)
          : (plan.display_name || plan.name);
        const description = locale === 'en'
          ? (plan.description_en || plan.description || plan.display_name || '')
          : (plan.description || plan.display_name || '');

        plansWithFeaturesMap.set(planId, {
          id: planId,
          name: displayName,
          displayName: displayName,
          description: description,
          priceMonthly: prices.monthly !== null && prices.monthly !== undefined 
            ? Math.round(prices.monthly) 
            : null,
          priceYearly: prices.yearly !== null && prices.yearly !== undefined 
            ? Math.round(prices.yearly) 
            : null,
          priceType: prices.monthly === null || prices.monthly === undefined ? 'custom' : 'fixed',
          maxUsers: plan.max_users || null,
          features: [],
          limits: {
            lots: plan.max_properties ?? null,
            users: plan.max_users ?? null,
            extranetTenants: plan.extranet_tenants_limit ?? null,
          },
          isActive: true,
          popular: plan.name === 'agency' || plan.name === 'agence',
        });
      }

      const planData = plansWithFeaturesMap.get(planId)!;

      // Only add enabled features (same as /admin/plan-features but only enabled ones for pricing)
      if (pf.is_enabled && feature) {
        // Use translated fields based on locale
        // Note: features table uses 'name_en' not 'display_name_en'
        const featureDisplayName = locale === 'en'
          ? (feature.name_en || feature.display_name || feature.name)
          : (feature.display_name || feature.name);
        const category: string = feature.category || 'Unknown';

        planData.features.push({
          text: featureDisplayName,
          included: true,
          category: category,
        });
      }
    });

    // Step 8: Add limits as features and organize by category for each plan
    const plansWithFeatures = Array.from(plansWithFeaturesMap.values()).map(plan => {
      // Build feature list with limits first, then features organized by category
      const featureItems: Array<{ text: string; included: boolean; category?: string }> = [];
      
      // Add limits as features
      const lotsLimit = plan.limits.lots === null || plan.limits.lots === undefined || plan.limits.lots === -1 
        ? 'Illimité' 
        : plan.limits.lots.toString();
      featureItems.push({
        text: `Lots: ${lotsLimit}`,
        included: true,
        category: 'limits',
      });
      
      const usersLimit = plan.limits.users === null || plan.limits.users === undefined || plan.limits.users === -1 
        ? 'Illimité' 
        : plan.limits.users.toString();
      featureItems.push({
        text: `Utilisateurs: ${usersLimit}`,
        included: true,
        category: 'limits',
      });
      
      const extranetLimit = plan.limits.extranetTenants === null || plan.limits.extranetTenants === undefined || plan.limits.extranetTenants === -1 
        ? 'Illimité' 
        : plan.limits.extranetTenants.toString();
      featureItems.push({
        text: `Intranet locataires: ${extranetLimit}`,
        included: true,
        category: 'limits',
      });

      // Group features by category
      const featuresByCategory = new Map<string, Array<{ text: string; included: boolean; category: string }>>();
      
      plan.features.forEach(feature => {
        const category = feature.category || 'Unknown';
        if (!featuresByCategory.has(category)) {
          featuresByCategory.set(category, []);
        }
        featuresByCategory.get(category)!.push({
          ...feature,
          category,
        });
      });

      // Add features organized by category
      const categoryOrder = ['core', 'tenants', 'leases', 'payments', 'accounting', 'advanced', 'support'];
      categoryOrder.forEach(category => {
        const categoryFeatures = featuresByCategory.get(category);
        if (categoryFeatures && categoryFeatures.length > 0) {
          categoryFeatures.forEach(feature => {
            featureItems.push(feature);
          });
        }
      });

      // Add any remaining categories not in the order list
      featuresByCategory.forEach((features, category) => {
        if (!categoryOrder.includes(category)) {
          features.forEach(feature => {
            featureItems.push(feature);
          });
        }
      });

      return {
        ...plan,
        features: featureItems,
      };
    });

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

