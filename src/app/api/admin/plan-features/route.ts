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

    // Get all plans with their features from JSONB
    const plans = await db.select<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      features: any; // JSONB field containing features object
    }>('plans', {
      filter: { is_active: true },
      orderBy: { column: 'created_at', ascending: true },
    });

    // For now, we'll create a mock features list based on what we know exists
    // TODO: Create proper features and plan_features tables
    const mockFeatures = [
      { id: '1', name: 'properties_management', display_name: 'Gestion des biens', description: 'Créer, modifier et supprimer des biens immobiliers', category: 'Core Features' },
      { id: '2', name: 'units_management', display_name: 'Gestion des lots', description: 'Gérer les lots et unités dans les biens', category: 'Property Management' },
      { id: '3', name: 'tenants_management', display_name: 'Gestion des locataires', description: 'Gérer les informations des locataires', category: 'Property Management' },
      { id: '4', name: 'leases_management', display_name: 'Gestion des baux', description: 'Créer et gérer les contrats de location', category: 'Property Management' },
      { id: '5', name: 'payments_tracking', display_name: 'Suivi des paiements', description: 'Enregistrer et suivre les paiements', category: 'Financial' },
      { id: '6', name: 'accounting_basic', display_name: 'Comptabilité de base', description: 'Fonctionnalités comptables de base', category: 'Financial' },
      { id: '7', name: 'tasks_management', display_name: 'Gestion des tâches', description: 'Créer et assigner des tâches', category: 'Core Features' },
      { id: '8', name: 'messaging_system', display_name: 'Système de messagerie', description: 'Communication interne et externe', category: 'Communication' },
      { id: '9', name: 'reports_basic', display_name: 'Rapports de base', description: 'Générer des rapports simples', category: 'Reporting' },
      { id: '10', name: 'user_management', display_name: 'Gestion des utilisateurs', description: 'Gérer les comptes utilisateur', category: 'Administration' },
    ];

    const features = mockFeatures;

    // Organize data by plan and feature
    const result = plans.map(plan => {
      // Get features from JSONB field (for now, assume it's an object with feature keys as boolean values)
      const planFeatures = plan.features || {};

      const featuresWithStatus = features.map(feature => {
        const isEnabled = Boolean(planFeatures[feature.name]); // Check if feature key exists and is truthy
        return {
          id: `${plan.id}-${feature.name}`, // Generate composite ID
          featureId: feature.id,
          featureKey: feature.name,
          featureName: feature.display_name,
          featureDescription: feature.description,
          category: feature.category,
          isEnabled: isEnabled,
          planFeatureId: `${plan.id}-${feature.name}`, // Generate composite ID
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

    // Check if plan exists and get current features
    const plan = await db.selectOne<{
      id: string;
      features: any;
    }>('plans', {
      eq: { id: validatedData.planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Update the features JSONB field
    const currentFeatures = plan.features || {};
    const updatedFeatures = {
      ...currentFeatures,
      [validatedData.featureKey]: validatedData.isEnabled,
    };

    await db.updateOne(
      'plans',
      {
        features: updatedFeatures,
        updated_at: new Date(),
      },
      { id: validatedData.planId }
    );

    return NextResponse.json({
      success: true,
      message: 'Plan feature updated successfully',
      planFeatureId: `${validatedData.planId}-${validatedData.featureKey}`,
      isEnabled: validatedData.isEnabled,
    });

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

    // Check if plan exists and get current features
    const plan = await db.selectOne<{
      id: string;
      features: any;
    }>('plans', {
      eq: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    const results = [];
    const currentFeatures = plan.features || {};
    const updatedFeatures = { ...currentFeatures };

    // Process each feature update
    for (const featureUpdate of features) {
      const { featureKey, isEnabled } = featureUpdate;

      if (typeof featureKey !== 'string' || typeof isEnabled !== 'boolean') {
        continue; // Skip invalid entries
      }

      // For now, we accept all feature keys since we have a mock list
      // In production, you would validate against the features table
      const currentValue = Boolean(currentFeatures[featureKey]);

      if (currentValue !== isEnabled) {
        updatedFeatures[featureKey] = isEnabled;
        results.push({
          featureKey,
          action: 'updated',
          isEnabled,
          planFeatureId: `${planId}-${featureKey}`,
        });
      }
    }

    // Update the plan with new features
    if (results.length > 0) {
      await db.updateOne(
        'plans',
        {
          features: updatedFeatures,
          updated_at: new Date(),
        },
        { id: planId }
      );
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
