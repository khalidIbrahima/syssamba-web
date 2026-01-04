/**
 * User Plan Features API
 * Returns the current user's plan and enabled features
 * 
 * Optimized version: Reduced from 5+ queries to 3 queries using Supabase joins
 * 
 * Database Schema (ACTUAL from Supabase):
 * - users.sb_user_id (UUID) references Supabase auth.users.id
 * - users.organization_id (UUID) references organizations.id
 * - subscriptions.organization_id (UUID) references organizations.id
 * - subscriptions.plan_id (UUID) references plans.id
 * - plan_features.plan_id (UUID) references plans.id
 * - plan_features.feature_id (UUID) references features.id (NOT features.key or features.name!)
 * - features.id (UUID, PK) - primary key
 * - features.name (TEXT, unique) - unique identifier used in code (e.g., "task_management")
 * - features.display_name (TEXT) - display name
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { supabaseAdmin } from '@/lib/db';

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

    // Query 1: Get user with organization_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, organization_id')
      .eq('sb_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const organizationId = userData.organization_id;
    if (!organizationId) {
      return NextResponse.json({
        plan: null,
        features: [],
        message: 'Aucune organisation associée',
      });
    }

    // Query 2: Get active subscription (separate query, then fetch plan)
    // Include multiple valid statuses: active, trialing, past_due (still active subscriptions)
    const { data: subscriptionData, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_id')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle();

    console.log('[plan-features] Subscription query:', { 
      subscriptionData, 
      subscriptionError: subscriptionError?.message,
      organizationId 
    });

    let plan: { id: string; name: string; display_name: string; description: string | null } | null = null;
    
    // If subscription exists, fetch the plan by plan_id
    if (!subscriptionError && subscriptionData && subscriptionData.plan_id) {
      console.log('[plan-features] Fetching plan by plan_id:', subscriptionData.plan_id);
      const { data: planData, error: planError } = await supabaseAdmin
        .from('plans')
        .select('id, name, display_name, description')
        .eq('id', subscriptionData.plan_id)
        .single();

      console.log('[plan-features] Plan query result:', { 
        planData, 
        planError: planError?.message 
      });

      if (!planError && planData) {
        plan = planData;
        console.log('[plan-features] Plan found from subscription:', plan.name);
      }
    }

    // Ensure plan is not null at this point
    if (!plan) {
      console.error('[plan-features] Plan is still null after all attempts');
      return NextResponse.json({
        plan: null,
        features: [],
        message: 'Impossible de déterminer le plan',
      }, { status: 500 });
    }

    // Query 3: Get plan_features with features in one join query
    // plan_features is a junction table: (plan_id, feature_id) is the composite PK
    // plan_features.feature_id (UUID) references features.id (UUID)
    const { data: planFeaturesData, error: planFeaturesError } = await supabaseAdmin
      .from('plan_features')
      .select(`
        plan_id,
        feature_id,
        is_enabled,
        limits,
        features!plan_features_feature_id_fkey(
          id,
          name,
          display_name,
          description,
          category
        )
      `)
      .eq('plan_id', plan.id);

    if (planFeaturesError) {
      console.error('[plan-features] Error fetching plan_features:', planFeaturesError);
      // If join fails, try without join and fetch separately
      return await getPlanFeaturesFallback(plan.id);
    }

    if (!planFeaturesData || planFeaturesData.length === 0) {
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

    // Transform the joined data
    // plan_features.feature_id matches features.id
    const enrichedFeatures = (planFeaturesData || [])
      .map((pf: any) => {
        const feature = pf.features;
        if (!feature) {
          console.warn(`[plan-features] Feature not found for feature_id: ${pf.feature_id}`);
          return null;
        }

        return {
          id: feature.id,
          featureKey: feature.name, // name is the unique identifier used in code (e.g., "task_management")
          displayName: feature.display_name || feature.name,
          description: feature.description,
          category: feature.category,
          isEnabled: pf.is_enabled,
          limits: pf.limits || null,
        };
      })
      .filter((f: any) => f !== null);

    const response = {
      plan: {
        id: plan.id,
        name: plan.name,
        displayName: plan.display_name,
        description: plan.description,
      },
      features: enrichedFeatures,
    };

    console.log('[plan-features] Final response:', {
      planId: response.plan.id,
      planName: response.plan.name,
      featuresCount: response.features.length,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[plan-features] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * Fallback method: Fetch plan_features and features separately
 * Used when the join query fails (e.g., foreign key constraint not properly set up)
 */
async function getPlanFeaturesFallback(planId: string) {
  try {
    // Get plan_features (junction table: no id column, composite PK is plan_id + feature_id)
    const { data: planFeaturesData, error: planFeaturesError } = await supabaseAdmin
      .from('plan_features')
      .select('plan_id, feature_id, is_enabled, limits')
      .eq('plan_id', planId);

    // Get plan info first to ensure we always return a plan
    const { data: planData } = await supabaseAdmin
      .from('plans')
      .select('id, name, display_name, description')
      .eq('id', planId)
      .single();

    if (planFeaturesError || !planFeaturesData || planFeaturesData.length === 0) {
      console.log('[plan-features] Fallback: No plan_features found, returning plan with empty features');
      return NextResponse.json({
        plan: planData ? {
          id: planData.id,
          name: planData.name,
          displayName: planData.display_name,
          description: planData.description,
        } : null,
        features: [],
        message: 'Aucune fonctionnalité trouvée pour ce plan',
      });
    }

    // Extract unique feature IDs
    const featureIds = [...new Set(planFeaturesData.map((pf: any) => pf.feature_id).filter(Boolean))];

    if (featureIds.length === 0) {
      console.log('[plan-features] Fallback: No feature IDs found, returning plan with empty features');
      return NextResponse.json({
        plan: planData ? {
          id: planData.id,
          name: planData.name,
          displayName: planData.display_name,
          description: planData.description,
        } : null,
        features: [],
        message: 'Aucune fonctionnalité trouvée',
      });
    }

    // Fetch features by id (UUID)
    const { data: featuresData, error: featuresError } = await supabaseAdmin
      .from('features')
      .select('id, name, display_name, description, category')
      .in('id', featureIds);

    if (featuresError) {
      console.error('[plan-features] Fallback: Error fetching features:', featuresError);
      return NextResponse.json({
        plan: planData ? {
          id: planData.id,
          name: planData.name,
          displayName: planData.display_name,
          description: planData.description,
        } : null,
        features: [],
        message: 'Erreur lors de la récupération des fonctionnalités',
      });
    }

    // Create lookup map for features (by id, not name!)
    const featuresMap = new Map((featuresData || []).map((f: any) => [f.id, f]));

    // Transform and combine plan_features with feature details
    const enrichedFeatures = planFeaturesData
      .map((pf: any) => {
        const feature = featuresMap.get(pf.feature_id);
        if (!feature) {
          console.warn(`[plan-features] Fallback: Feature not found for feature_id: ${pf.feature_id}`);
          return null;
        }

        return {
          id: feature.id,
          featureKey: feature.name, // name is the unique identifier used in code
          displayName: feature.display_name || feature.name,
          description: feature.description,
          category: feature.category,
          isEnabled: pf.is_enabled,
          limits: pf.limits || null,
        };
      })
      .filter((f: any) => f !== null);

    return NextResponse.json({
      plan: planData ? {
        id: planData.id,
        name: planData.name,
        displayName: planData.display_name,
        description: planData.description,
      } : null,
      features: enrichedFeatures,
    });
  } catch (error: any) {
    console.error('[plan-features] Fallback error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
