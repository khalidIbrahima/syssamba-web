import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db, supabaseAdmin } from '@/lib/db';
import { z } from 'zod';

// Validation schemas
const updatePlanFeatureSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  featureKey: z.string().min(1, 'Feature key is required'),
  isEnabled: z.boolean(),
});

const createPlanFeatureSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  featureKey: z.string().min(1, 'Feature key is required'),
  isEnabled: z.boolean().default(true),
});

/**
 * GET /api/admin/plan-features
 * Get all plan features with their current status for all plans
 */
// API endpoint to get feature mappings and object relationships
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);
    console.log('User ID:', user.id, 'Is Super Admin:', userIsSuperAdmin);

    if (!userIsSuperAdmin) {
      console.log('Access denied: User is not a super admin');
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    // Use Supabase's built-in join capability to fetch plan_features with related data
    const { data: planFeaturesWithDetails, error } = await supabaseAdmin
      .from('plan_features')
      .select(`
        id,
        plan_id,
        feature_id,
        is_enabled,
        limits,
        created_at,
        plans (
          id,
          name,
          display_name,
          description
        ),
        features (
        id,
          name,
          display_name,
          description,
          category
        )
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching plan features with joins:', error);
      return NextResponse.json(
        { error: 'Failed to fetch plan features data' },
        { status: 500 }
      );
    }

    console.log('Fetched plan_features with joined data:', planFeaturesWithDetails?.length || 0);

    // Transform the nested Supabase response to flat structure
    const flattenedPlanFeatures = planFeaturesWithDetails?.map(pf => ({
      id: pf.id,
      plan_id: pf.plan_id,
      feature_id: pf.feature_id,
      is_enabled: pf.is_enabled,
      limits: pf.limits,
      created_at: pf.created_at,
      plan_name: pf.plans?.[0]?.name || null,
      plan_display_name: pf.plans?.[0]?.display_name || null,
      plan_description: pf.plans?.[0]?.description || null,
      feature_name: pf.features?.[0]?.name || null,
      feature_display_name: pf.features?.[0]?.display_name || null,
      feature_description: pf.features?.[0]?.description || null,
      feature_category: pf.features?.[0]?.category || null,
    })) || [];

    // Group by plan and enrich with inferred data when joins fail
    const result = new Map<string, {
      id: string;
      name: string;
      displayName: string;
      description: string | null;
      features: Array<{
        id: string;
        featureId: string;
        featureKey: string;
        featureName: string;
        featureDescription: string | null;
        category: string;
        isEnabled: boolean;
        limits: any;
        createdAt: string;
      }>;
      featuresByCategory: Record<string, any[]>;
      totalFeatures: number;
      enabledFeatures: number;
    }>();

    flattenedPlanFeatures.forEach(pf => {
      const planId = pf.plan_id;

      if (!result.has(planId)) {
        // Determine plan information - use joined data if available, otherwise infer
        let planName = pf.plan_name;
        let planDisplayName = pf.plan_display_name;
        let planDescription = pf.plan_description;

        if (!planName || !planDisplayName) {
          // Infer plan name from limits data
          let inferredDisplayName = `Plan ${planId.substring(0, 8)}`;
          let inferredName = `plan_${planId.substring(0, 8)}`;

          if (pf.limits && typeof pf.limits === 'object' && 'max_properties' in pf.limits) {
            const maxProps = pf.limits.max_properties;
            if (maxProps === 5) {
              inferredDisplayName = 'Freemium Plan';
              inferredName = 'freemium';
            } else if (maxProps === 25) {
              inferredDisplayName = 'Starter Plan';
              inferredName = 'starter';
            } else if (maxProps === 100) {
              inferredDisplayName = 'Professional Plan';
              inferredName = 'professional';
            } else if (maxProps === -1 || maxProps > 100) {
              inferredDisplayName = 'Enterprise Plan';
              inferredName = 'enterprise';
            }
          }

          planName = planName || inferredName;
          planDisplayName = planDisplayName || inferredDisplayName;
          planDescription = planDescription || 'Plan information loaded from plan_features data';
        }

        result.set(planId, {
          id: planId,
          name: planName,
          displayName: planDisplayName,
          description: planDescription,
          features: [],
          featuresByCategory: {},
          totalFeatures: 0,
          enabledFeatures: 0,
        });
      }

      const plan = result.get(planId)!;

      // Use feature information from the database join - no hardcoded fallbacks needed
      const featureKey = pf.feature_name || pf.feature_id;
      const featureName = pf.feature_display_name || `Feature ${pf.feature_id.substring(0, 8)}`;
      const featureDescription = pf.feature_description;
      const category = pf.feature_category || 'Unknown';

      const feature = {
        id: pf.id,
        featureId: pf.feature_id,
        featureKey: featureKey,
        featureName: featureName,
        featureDescription: featureDescription,
        category: category,
        isEnabled: pf.is_enabled,
        limits: pf.limits,
        createdAt: pf.created_at,
      };

      plan.features.push(feature);

      // Group by category
      if (!plan.featuresByCategory[category]) {
        plan.featuresByCategory[category] = [];
      }
      plan.featuresByCategory[category].push(feature);
    });

    // Calculate totals for each plan
    const finalResult = Array.from(result.values()).map(plan => ({
      ...plan,
      totalFeatures: plan.features.length,
      enabledFeatures: plan.features.filter(f => f.isEnabled).length,
    }));

    // Debug: Check display names
    console.log('=== DEBUG: Plan Display Names ===');
    finalResult.forEach(plan => {
      console.log(`Plan ID: ${plan.id}`);
      console.log(`Plan Name: ${plan.name}`);
      console.log(`Plan Display Name: ${plan.displayName}`);
      console.log(`Plan Description: ${plan.description}`);
      console.log('---');
    });

    console.log(`Organized into ${finalResult.length} plans with features`);
    finalResult.forEach(plan => {
      console.log(`- ${plan.displayName}: ${plan.totalFeatures} features (${plan.enabledFeatures} enabled)`);
    });

    return NextResponse.json({
      plans: finalResult,
      totalPlans: finalResult.length,
      totalFeatures: flattenedPlanFeatures.length,
      totalPlanFeatureRecords: flattenedPlanFeatures.length,
    });

  } catch (error) {
    console.error('Error fetching plan features:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/plan-features
 * Create or update a plan feature relationship
 */
export async function POST(request: NextRequest) {
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin or Global Administrator access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createPlanFeatureSchema.parse(body);

    // Check if plan exists
    const plan = await db.selectOne<{ id: string }>('plans', {
      eq: { id: validatedData.planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // For POST endpoint, we expect featureKey to be the feature name, but we need to find the feature by name first
    let featureId: string;

    // Check if featureKey is a UUID (feature_id) or name
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validatedData.featureKey);

    if (isUUID) {
      // featureKey is already a UUID (feature_id)
      featureId = validatedData.featureKey;
    } else {
      // featureKey is a feature name, need to find the feature
      const feature = await db.selectOne<{ id: string }>('features', {
        eq: { name: validatedData.featureKey },
      });

      if (!feature) {
        return NextResponse.json(
          { error: 'Feature not found' },
          { status: 404 }
        );
      }
      featureId = feature.id;
    }

    // Check if plan_feature relationship already exists
    const existingRelation = await db.selectOne<{
      id: string;
      is_enabled: boolean;
    }>('plan_features', {
      eq: {
        plan_id: validatedData.planId,
        feature_id: featureId,
      },
    });

    if (existingRelation) {
      // Update existing relationship
      await db.updateOne(
        'plan_features',
        {
          is_enabled: validatedData.isEnabled,
        },
        { id: existingRelation.id }
      );

      return NextResponse.json({
        success: true,
        message: 'Plan feature updated successfully',
        planFeatureId: existingRelation.id,
        isEnabled: validatedData.isEnabled,
      });
    } else {
      // Create new relationship
      const newRelation = await db.insertOne('plan_features', {
        plan_id: validatedData.planId,
        feature_id: featureId,
        is_enabled: validatedData.isEnabled,
      });

      if (!newRelation) {
        return NextResponse.json(
          { error: 'Failed to create plan feature relationship' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Plan feature created successfully',
        planFeatureId: newRelation.id,
        isEnabled: validatedData.isEnabled,
      });
    }

  } catch (error) {
    console.error('Error creating/updating plan feature:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/plan-features
 * Bulk update plan features for a specific plan
 */
export async function PUT(request: NextRequest) {
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin or Global Administrator access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { planId, features } = body;

    if (!planId || !Array.isArray(features)) {
      return NextResponse.json(
        { error: 'Invalid data: planId and features array required' },
        { status: 400 }
      );
    }

    // Check if plan exists
    const plan = await db.selectOne<{ id: string }>('plans', {
      eq: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    const results = [];

    // Process each feature update
    for (const featureUpdate of features) {
      const { featureKey, isEnabled } = featureUpdate;

      if (typeof featureKey !== 'string' || typeof isEnabled !== 'boolean') {
        continue; // Skip invalid entries
      }

      // Determine if featureKey is a UUID (feature_id) or name
      let featureId: string;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(featureKey);

      if (isUUID) {
        // featureKey is already a UUID (feature_id)
        featureId = featureKey;
      } else {
        // featureKey is a feature name, need to find the feature
        const feature = await db.selectOne<{ id: string }>('features', {
          eq: { name: featureKey },
        });

        if (!feature) {
          console.warn(`Feature ${featureKey} not found, skipping`);
          continue; // Skip if feature doesn't exist
        }
        featureId = feature.id;
      }

      // Check if plan_feature relationship already exists
      const existingRelation = await db.selectOne<{
        id: string;
        is_enabled: boolean;
      }>('plan_features', {
        eq: {
          plan_id: planId,
          feature_id: featureId,
        },
      });

      if (existingRelation) {
        // Update existing relationship if value changed
        if (existingRelation.is_enabled !== isEnabled) {
          await db.updateOne(
            'plan_features',
            {
              is_enabled: isEnabled,
            },
            { id: existingRelation.id }
          );

          results.push({
            featureKey,
            action: 'updated',
            isEnabled,
            planFeatureId: existingRelation.id,
          });
        }
      } else {
        // Create new relationship
        const newRelation = await db.insertOne('plan_features', {
          plan_id: planId,
          feature_id: featureId,
          is_enabled: isEnabled,
        });

        if (newRelation) {
          results.push({
            featureKey,
            action: 'created',
            isEnabled,
            planFeatureId: newRelation.id,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.length} plan features`,
      results,
    });

  } catch (error) {
    console.error('Error bulk updating plan features:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
