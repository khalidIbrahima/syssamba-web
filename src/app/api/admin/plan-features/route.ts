import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db } from '@/lib/db';
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

    // Get all plan_features relationships
    const planFeatures = await db.select<{
      id: string;
      plan_id: string;
      feature_id: string;
      is_enabled: boolean;
      limits: any;
      created_at: string;
    }>('plan_features', {
      orderBy: { column: 'created_at', ascending: true },
    });

    console.log('Found plan_features relationships:', planFeatures.length);

    // Get unique plan IDs from plan_features
    const planIds = [...new Set(planFeatures.map(pf => pf.plan_id))];
    console.log('Unique plan IDs found:', planIds.length, planIds);

    // Get plan information for these IDs
    const plansInfo: Array<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
    }> = [];

    for (const planId of planIds) {
      try {
        const plan = await db.selectOne<{
          id: string;
          name: string;
          display_name: string;
          description: string | null;
        }>('plans', {
          eq: { id: planId },
        });

        if (plan) {
          plansInfo.push(plan);
        } else {
          console.log(`Plan ${planId} not found, creating placeholder`);
          plansInfo.push({
            id: planId,
            name: `plan-${planId.substring(0, 8)}`,
            display_name: `Plan ${planId.substring(0, 8)}`,
            description: 'Plan information not accessible',
          });
        }
      } catch (error) {
        console.log(`Error fetching plan ${planId}:`, error);
        plansInfo.push({
          id: planId,
          name: `plan-${planId.substring(0, 8)}`,
          display_name: `Plan ${planId.substring(0, 8)}`,
          description: 'Plan information not accessible',
        });
      }
    }

    console.log('Retrieved plan info for:', plansInfo.length, 'plans');

    // Group plan_features by plan
    const result = plansInfo.map(plan => {
      const planFeaturesForPlan = planFeatures.filter(pf => pf.plan_id === plan.id);

      // Create feature objects from plan_features data
      const featuresWithStatus = planFeaturesForPlan.map(pf => {
        // Try to map known feature IDs to names (from inspection data)
        const featureMappings: Record<string, { name: string; displayName: string; category: string }> = {
          'bf015fcd-7da4-49fe-85b2-21da9e570ef5': {
            name: 'properties_management',
            displayName: 'Gestion des biens',
            category: 'Core Features'
          },
          '958e71f4-3e10-4014-a943-6088ec54e9d9': {
            name: 'units_management',
            displayName: 'Gestion des lots',
            category: 'Property Management'
          },
          // Add more mappings as needed
        };

        const featureInfo = featureMappings[pf.feature_id] || {
          name: pf.feature_id,
          displayName: `Feature ${pf.feature_id.substring(0, 8)}`,
          category: 'Unknown',
        };

        return {
          id: pf.id,
          featureId: pf.feature_id,
          featureKey: featureInfo.name,
          featureName: featureInfo.displayName,
          featureDescription: pf.limits ? `Limits: ${JSON.stringify(pf.limits)}` : null,
          category: featureInfo.category,
          isEnabled: pf.is_enabled,
          planFeatureId: pf.id,
          limits: pf.limits,
          createdAt: pf.created_at,
        };
      });

      // Group features by category
      const featuresByCategory = featuresWithStatus.reduce((acc, feature) => {
        if (!acc[feature.category]) {
          acc[feature.category] = [];
        }
        acc[feature.category].push(feature);
        return acc;
      }, {} as Record<string, typeof featuresWithStatus>);

      return {
        plan: {
          id: plan.id,
          name: plan.name,
          displayName: plan.display_name,
          description: plan.description,
        },
        features: featuresWithStatus,
        featuresByCategory,
        totalFeatures: featuresWithStatus.length,
        enabledFeatures: featuresWithStatus.filter(f => f.isEnabled).length,
      };
    });

    console.log(`Organized into ${result.length} plans with features`);
    result.forEach(plan => {
      console.log(`- ${plan.plan.displayName}: ${plan.totalFeatures} features (${plan.enabledFeatures} enabled)`);
    });

    console.log('API Response:', {
      plans: result.length,
      totalPlans: result.length,
      totalFeatures: planFeatures.length,
    });

    return NextResponse.json({
      plans: result,
      totalPlans: result.length,
      totalFeatures: planFeatures.length,
      totalPlanFeatureRecords: planFeatures.length,
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
