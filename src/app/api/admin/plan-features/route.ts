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

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin or Global Administrator access required' },
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
      orderBy: { column: 'created_at', ascending: true },
    });

    // Get all features
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

    // Get all plan-feature relationships
    const planFeatures = await db.select<{
      id: string;
      plan_id: string;
      feature_name: string;
      is_enabled: boolean;
      created_at: string;
      updated_at: string;
    }>('plan_features', {
      orderBy: { column: 'created_at', ascending: true },
    });

    // Organize data by plan and feature
    const result = plans.map(plan => {
      const planFeaturesForPlan = planFeatures.filter(pf => pf.plan_id === plan.id);

      const featuresWithStatus = features.map(feature => {
        const planFeature = planFeaturesForPlan.find(pf => pf.feature_name === feature.name);
        return {
          id: planFeature?.id || null,
          featureId: feature.id,
          featureKey: feature.name,
          featureName: feature.display_name,
          featureDescription: feature.description,
          category: feature.category,
          isEnabled: planFeature?.is_enabled || false,
          planFeatureId: planFeature?.id || null,
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

    // Check if feature exists
    const feature = await db.selectOne<{ id: string }>('features', {
      eq: { name: validatedData.featureKey },
    });

    if (!feature) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }

    // Check if plan-feature relationship already exists
    const existing = await db.selectOne<{
      id: string;
      is_enabled: boolean;
    }>('plan_features', {
      eq: {
        plan_id: validatedData.planId,
        feature_name: validatedData.featureKey,
      },
    });

    if (existing) {
      // Update existing relationship
      await db.updateOne(
        'plan_features',
        {
          is_enabled: validatedData.isEnabled,
          updated_at: new Date(),
        },
        { id: existing.id }
      );

      return NextResponse.json({
        success: true,
        message: 'Plan feature updated successfully',
        planFeatureId: existing.id,
        isEnabled: validatedData.isEnabled,
      });
    } else {
      // Create new relationship
      const newPlanFeature = await db.insertOne('plan_features', {
        plan_id: validatedData.planId,
        feature_name: validatedData.featureKey,
        is_enabled: validatedData.isEnabled,
      });

      if (!newPlanFeature) {
        return NextResponse.json(
          { error: 'Failed to create plan feature relationship' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Plan feature created successfully',
        planFeatureId: newPlanFeature.id,
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

      // Check if feature exists
      const feature = await db.selectOne<{ id: string }>('features', {
        eq: { name: featureKey },
      });

      if (!feature) {
        continue; // Skip if feature doesn't exist
      }

      // Check if plan-feature relationship already exists
      const existing = await db.selectOne<{
        id: string;
        is_enabled: boolean;
      }>('plan_features', {
        eq: {
          plan_id: planId,
          feature_name: featureKey,
        },
      });

      if (existing) {
        // Update existing relationship
        if (existing.is_enabled !== isEnabled) {
          await db.updateOne(
            'plan_features',
            {
              is_enabled: isEnabled,
              updated_at: new Date(),
            },
            { id: existing.id }
          );

          results.push({
            featureKey,
            action: 'updated',
            isEnabled,
            planFeatureId: existing.id,
          });
        }
      } else {
        // Create new relationship
        const newPlanFeature = await db.insertOne('plan_features', {
          plan_id: planId,
          feature_name: featureKey,
          is_enabled: isEnabled,
        });

        if (newPlanFeature) {
          results.push({
            featureKey,
            action: 'created',
            isEnabled,
            planFeatureId: newPlanFeature.id,
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
