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

    // Get all plans
    const plans = await db.select<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
    }>('plans', {
      filter: { is_active: true },
      orderBy: { column: 'created_at', ascending: true },
    });

    console.log('Found plans:', plans.length);

    // Get all features from features table
    const features = await db.select<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      category: string;
      is_active: boolean;
    }>('features', {
      filter: { is_active: true },
      orderBy: { column: 'category', ascending: true },
    });

    console.log('Found features:', features.length);

    // Get all plan_features relationships (actual table structure)
    const planFeatures = await db.select<{
      id: string;
      plan_id: string;
      feature_id: string; // This is the correct column name
      is_enabled: boolean;
      limits: any; // JSONB field for limits
      created_at: string;
    }>('plan_features', {
      orderBy: { column: 'created_at', ascending: true },
    });

    console.log('Found plan_features relationships:', planFeatures.length);

    // Organize data by plan and feature using plan_features junction table
    const result = plans.map(plan => {
      // Get plan_features relationships for this plan
      const planFeatureRelations = planFeatures.filter(pf => pf.plan_id === plan.id);

      const featuresWithStatus = features.map(feature => {
        // Find the relationship in plan_features table by feature_id
        const relation = planFeatureRelations.find(pf => pf.feature_id === feature.id);
        const isEnabled = relation ? relation.is_enabled : false;

        return {
          id: relation?.id || `${plan.id}-${feature.id}`, // Use real ID if exists, otherwise generate
          featureId: feature.id,
          featureKey: feature.name,
          featureName: feature.display_name,
          featureDescription: feature.description,
          category: feature.category,
          isEnabled: isEnabled,
          planFeatureId: relation?.id || null, // Real plan_feature ID or null
          limits: relation?.limits || null, // Include limits if available
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
      };
    });

    console.log('API Response:', {
      plans: result.length,
      totalPlans: plans.length,
      totalFeatures: features.length,
    });

    return NextResponse.json({
      plans: result,
      totalPlans: plans.length,
      totalFeatures: features.length,
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
