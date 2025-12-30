/**
 * User Plan Features API
 * Returns the current user's plan and enabled features
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Get user from database
    const dbUser = await db.selectOne<{
      id: string;
      email: string;
      organization_id: string | null;
    }>('users', {
      eq: { sb_user_id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Get user's organization
    if (!dbUser.organization_id) {
      return NextResponse.json({
        plan: null,
        features: [],
        message: 'Aucune organisation associée',
      });
    }

    const organization = await db.selectOne<{
      id: string;
      name: string;
      plan_id: string | null;
    }>('organizations', {
      eq: { id: dbUser.organization_id },
    });

    if (!organization || !organization.plan_id) {
      return NextResponse.json({
        plan: null,
        features: [],
        message: 'Aucun plan associé à l\'organisation',
      });
    }

    // Get plan details
    const plan = await db.selectOne<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
    }>('plans', {
      eq: { id: organization.plan_id },
    });

    if (!plan) {
      return NextResponse.json({
        plan: null,
        features: [],
        message: 'Plan non trouvé',
      });
    }

    // Get plan features with feature details
    const planFeatures = await db.select<{
      id: string;
      feature_id: string;
      is_enabled: boolean;
      limits: any;
    }>('plan_features', {
      eq: { plan_id: plan.id },
    });

    // Get all feature IDs
    const featureIds = planFeatures.map((pf) => pf.feature_id);

    if (featureIds.length === 0) {
      return NextResponse.json({
        plan: {
          id: plan.id,
          name: plan.name,
          displayName: plan.display_name,
          description: plan.description,
        },
        features: [],
      });
    }

    // Fetch feature details
    const features = await db.select<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      category: string;
    }>('features', {
      in: { id: featureIds },
    });

    // Create a map of features
    const featuresMap = new Map(
      features.map((f) => [f.id, f])
    );

    // Combine plan features with feature details
    const enrichedFeatures = planFeatures
      .map((pf) => {
        const feature = featuresMap.get(pf.feature_id);
        if (!feature) return null;

        return {
          id: feature.id,
          name: feature.name,
          displayName: feature.display_name,
          description: feature.description,
          category: feature.category,
          isEnabled: pf.is_enabled,
          limits: pf.limits,
        };
      })
      .filter((f) => f !== null);

    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        displayName: plan.display_name,
        description: plan.description,
      },
      features: enrichedFeatures,
    });
  } catch (error: any) {
    console.error('Error fetching user plan features:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

