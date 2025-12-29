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

    // Get unique plan IDs and feature IDs
    const planIds = [...new Set(planFeatures.map(pf => pf.plan_id))];
    const featureIds = [...new Set(planFeatures.map(pf => pf.feature_id))];

    console.log('Unique plan IDs found:', planIds.length, planIds);
    console.log('Unique feature IDs found:', featureIds.length, featureIds);

    // Try to get plan information
    const plansMap = new Map<string, {
      id: string;
      name: string;
      display_name: string;
      description: string | null;
    }>();

    // First try to get all plans at once
    try {
      console.log('Attempting to fetch all plans...');
      const allPlans = await db.select<{
        id: string;
        name: string;
        display_name: string;
        description: string | null;
      }>('plans', {
        orderBy: { column: 'created_at', ascending: false },
      });

      allPlans.forEach(plan => plansMap.set(plan.id, plan));
      console.log(`Successfully fetched ${allPlans.length} plans`);
    } catch (error) {
      console.log('Failed to fetch all plans, trying individual lookups:', error);
    }

    // Fill in missing plans with individual lookups or inference
    for (const planId of planIds) {
      if (!plansMap.has(planId)) {
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
            plansMap.set(planId, plan);
            console.log(`Found plan ${planId}: ${plan.name} (${plan.display_name})`);
          } else {
            throw new Error('Plan not found');
          }
        } catch (error) {
          console.log(`Plan ${planId} not accessible, creating inferred data`);

          // Infer plan name from limits
          const planFeaturesForThisPlan = planFeatures.filter(pf => pf.plan_id === planId);
          let displayName = `Plan ${planId.substring(0, 8)}`;
          let name = `plan_${planId.substring(0, 8)}`;

          if (planFeaturesForThisPlan.length > 0) {
            const limits = planFeaturesForThisPlan[0].limits;
            if (limits && typeof limits === 'object' && 'max_properties' in limits) {
              const maxProps = limits.max_properties;
              if (maxProps === 5) {
                displayName = 'Freemium Plan';
                name = 'freemium';
              } else if (maxProps === 25) {
                displayName = 'Starter Plan';
                name = 'starter';
              } else if (maxProps === 100) {
                displayName = 'Professional Plan';
                name = 'professional';
              } else if (maxProps === -1 || maxProps > 100) {
                displayName = 'Enterprise Plan';
                name = 'enterprise';
              }
            }
          }

          plansMap.set(planId, {
            id: planId,
            name,
            display_name: displayName,
            description: 'Plan inferred from plan_features data',
          });
        }
      }
    }

    // Try to get feature information
    const featuresMap = new Map<string, {
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      category: string;
    }>();

    // First try to get all features at once
    try {
      console.log('Attempting to fetch all features...');
      const allFeatures = await db.select<{
        id: string;
        name: string;
        display_name: string;
        description: string | null;
        category: string;
      }>('features', {
        orderBy: { column: 'category', ascending: true },
      });

      allFeatures.forEach(feature => featuresMap.set(feature.id, feature));
      console.log(`Successfully fetched ${allFeatures.length} features`);
    } catch (error) {
      console.log('Failed to fetch all features, using mappings:', error);
    }

    // Fill in missing features with mappings
    for (const featureId of featureIds) {
      if (!featuresMap.has(featureId)) {
        // Use hardcoded mappings for known feature IDs
        const featureMappings: Record<string, { name: string; displayName: string; category: string; description?: string }> = {
          'bf015fcd-7da4-49fe-85b2-21da9e570ef5': {
            name: 'properties_management',
            displayName: 'Gestion des biens',
            category: 'Core Features',
            description: 'Manage properties and real estate assets'
          },
          '958e71f4-3e10-4014-a943-6088ec54e9d9': {
            name: 'units_management',
            displayName: 'Gestion des lots',
            category: 'Property Management',
            description: 'Manage individual units within properties'
          },
        };

        const mapping = featureMappings[featureId];
        if (mapping) {
          featuresMap.set(featureId, {
            id: featureId,
            name: mapping.name,
            display_name: mapping.displayName,
            description: mapping.description || null,
            category: mapping.category,
          });
        } else {
          // Create placeholder for unknown features
          featuresMap.set(featureId, {
            id: featureId,
            name: featureId,
            display_name: `Feature ${featureId.substring(0, 8)}`,
            description: null,
            category: 'Unknown',
          });
        }
      }
    }

    // Now combine all the data
    const planFeaturesWithDetails = planFeatures.map(pf => ({
      ...pf,
      plan_name: plansMap.get(pf.plan_id)?.name || null,
      plan_display_name: plansMap.get(pf.plan_id)?.display_name || null,
      plan_description: plansMap.get(pf.plan_id)?.description || null,
      feature_name: featuresMap.get(pf.feature_id)?.name || null,
      feature_display_name: featuresMap.get(pf.feature_id)?.display_name || null,
      feature_description: featuresMap.get(pf.feature_id)?.description || null,
      feature_category: featuresMap.get(pf.feature_id)?.category || null,
    }));

    console.log('Found plan_features with details:', planFeaturesWithDetails.length);

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

    planFeaturesWithDetails.forEach(pf => {
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

      // Determine feature information - use joined data if available, otherwise use mappings
      let featureKey = pf.feature_name;
      let featureName = pf.feature_display_name;
      let featureDescription = pf.feature_description;
      let category = pf.feature_category || 'Unknown';

      if (!featureKey || !featureName) {
        // Use hardcoded mappings for known feature IDs
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
        };

        const mapping = featureMappings[pf.feature_id] || {
          name: pf.feature_id,
          displayName: `Feature ${pf.feature_id.substring(0, 8)}`,
          category: 'Unknown',
        };

        featureKey = featureKey || mapping.name;
        featureName = featureName || mapping.displayName;
        category = category !== 'Unknown' ? category : mapping.category;
      }

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

    console.log('Retrieved plan info for:', plansMap.size, 'plans');

    // Group plan_features by plan
    console.log(`Organized into ${finalResult.length} plans with features`);
    finalResult.forEach(plan => {
      console.log(`- ${plan.displayName}: ${plan.totalFeatures} features (${plan.enabledFeatures} enabled)`);
    });

    console.log('API Response:', {
      plans: finalResult.length,
      totalPlans: finalResult.length,
    });

    return NextResponse.json({
      plans: finalResult,
      totalPlans: finalResult.length,
      totalFeatures: planFeaturesWithDetails.length,
      totalPlanFeatureRecords: planFeaturesWithDetails.length,
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
