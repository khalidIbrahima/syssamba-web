// Plan Features Management
// Functions to manage and query plan features from the database

import { db } from './db';
import type { PlanName } from './permissions';

/**
 * Helper function to get plan_id from plan_name
 */
async function getPlanIdFromName(planName: PlanName): Promise<string | null> {
  try {
    const plan = await db.selectOne<{
      id: string;
    }>('plans', {
      eq: { name: planName },
    });
    return plan?.id || null;
  } catch (error) {
    console.error('Error fetching plan ID:', error);
    return null;
  }
}

export interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanFeature {
  id: string;
  planName: PlanName;
  featureKey: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanFeatureWithDetails extends PlanFeature {
  feature: Feature;
}

/**
 * Get all features (reference table)
 * Uses actual Supabase schema: name (key), display_name, etc.
 */
export async function getAllFeatures(): Promise<Feature[]> {
  try {
    const features = await db.select<{
      id: string;
      key: string; // Feature key (e.g., "task_management")
      name: string; // Feature name
      display_name?: string; // Display name (if exists in schema)
      description: string | null;
      category: string;
      icon: string | null;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>('features', {
      filter: { is_active: true },
      orderBy: { column: 'category', ascending: true },
    });

    return features.map(f => ({
      id: f.id,
      key: f.key, // Use key as key
      name: (f as any).display_name || f.name, // Use display_name if exists, otherwise name (same approach as /admin/plan-features)
      description: f.description,
      category: f.category,
      icon: f.icon,
      isActive: f.is_active,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching features:', error);
    return [];
  }
}

/**
 * Get features by category
 * Uses actual Supabase schema
 */
export async function getFeaturesByCategory(category: string): Promise<Feature[]> {
  try {
    const features = await db.select<{
      id: string;
      key: string; // Feature key
      name: string; // Display name
      description: string | null;
      category: string;
      icon: string | null;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>('features', {
      eq: { category },
      filter: { is_active: true },
      orderBy: { column: 'name', ascending: true },
    });

    return features.map(f => ({
      id: f.id,
      key: f.key, // Use key as key
      name: f.name, // Use name as display name
      description: f.description,
      category: f.category,
      icon: f.icon,
      isActive: f.is_active,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching features by category:', error);
    return [];
  }
}

/**
 * Get all features enabled for a specific plan
 * Uses feature_id to join with features table
 */
export async function getPlanFeatures(planName: PlanName): Promise<PlanFeatureWithDetails[]> {
  try {
    const planId = await getPlanIdFromName(planName);
    if (!planId) {
      console.error(`Plan not found: ${planName}`);
      return [];
    }

    // Get plan_features with feature_key (direct access)
    const planFeatures = await db.select<{
      id: string;
      plan_id: string;
      feature_key: string;
      is_enabled: boolean;
      limits: Record<string, any> | null;
      created_at: Date;
    }>('plan_features', {
      eq: { plan_id: planId, is_enabled: true },
    });

    if (planFeatures.length === 0) {
      return [];
    }

    // Get all feature keys
    const featureKeys = planFeatures.map(pf => pf.feature_key);

    // Fetch feature details using feature keys (more efficient: one query instead of N queries)
    const features = await db.select<{
      id: string;
      key: string;
      name: string;
      description: string | null;
      category: string;
      created_at: Date;
      updated_at: Date;
    }>('features', {
      in: { key: featureKeys },
    });

    // Create a map of features by key
    const featuresMap = new Map(
      features.map(f => [f.key, f])
    );

    // Combine plan features with feature details
    const featuresWithDetails: PlanFeatureWithDetails[] = planFeatures
      .map((pf) => {
        const feature = featuresMap.get(pf.feature_key);
        if (!feature) return null;

        const result: PlanFeatureWithDetails = {
          id: pf.id,
          planName: planName,
          featureKey: feature.key,
          isEnabled: pf.is_enabled,
          createdAt: pf.created_at,
          updatedAt: feature.updated_at,
          feature: {
            id: feature.id,
            key: feature.key,
            name: feature.name,
            description: feature.description,
            category: feature.category,
            icon: null, // Not in current schema
            isActive: true, // Assume active if in plan_features
            createdAt: feature.created_at,
            updatedAt: feature.updated_at,
          },
        };
        return result;
      })
      .filter((f): f is PlanFeatureWithDetails => f !== null);

    // Sort by feature name
    featuresWithDetails.sort((a, b) => a.featureKey.localeCompare(b.featureKey));

    return featuresWithDetails;
  } catch (error) {
    console.error('Error fetching plan features:', error);
    return [];
  }
}

/**
 * Get all features for a plan (enabled and disabled) with their status
 * Only returns features that are in plan_features table for this plan (grouped by plan)
 * Uses feature_key to join with features table
 */
export async function getAllPlanFeaturesWithStatus(planName: PlanName): Promise<Array<Feature & { isEnabled: boolean }>> {
  try {
    const planId = await getPlanIdFromName(planName);
    if (!planId) {
      console.error(`Plan not found: ${planName}`);
      return [];
    }

    // Get ONLY features that are in plan_features table for this plan (grouped by plan)
    const planFeatures = await db.select<{
      feature_key: string;
      is_enabled: boolean;
    }>('plan_features', {
      eq: { plan_id: planId },
    });

    if (planFeatures.length === 0) {
      return [];
    }

    // Get feature keys from plan_features for this plan
    const featureKeys = planFeatures.map(pf => pf.feature_key);
    const enabledFeatureKeys = new Set(
      planFeatures.filter(pf => pf.is_enabled).map(pf => pf.feature_key)
    );

    // Fetch feature details using feature keys (only features linked to this plan)
    const features = await db.select<{
      id: string;
      key: string; // Feature key
      name: string; // Feature name (may be key or display name)
      display_name?: string; // Display name (if exists in schema)
      description: string | null;
      category: string;
      icon: string | null;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>('features', {
      in: { key: featureKeys },
      filter: { is_active: true },
      orderBy: { column: 'category', ascending: true },
    });

    // Map features with their enabled status (only features in plan_features for this plan)
    // Use display_name if available, otherwise use name (same approach as /admin/plan-features)
    return features.map(feature => ({
      id: feature.id,
      key: feature.key, // Use key as key
      name: (feature as any).display_name || feature.name, // Use display_name if exists, otherwise name
      description: feature.description,
      category: feature.category,
      icon: feature.icon,
      isActive: feature.is_active,
      createdAt: feature.created_at,
      updatedAt: feature.updated_at,
      isEnabled: enabledFeatureKeys.has(feature.key), // Check by key
    }));
  } catch (error) {
    console.error('Error fetching plan features with status:', error);
    return [];
  }
}

/**
 * Check if a specific feature is enabled for a plan
 * Uses feature_key directly (no need to find feature_id first)
 */
export async function isFeatureEnabled(planName: PlanName, featureKey: string): Promise<boolean> {
  try {
    const planId = await getPlanIdFromName(planName);
    if (!planId) {
      return false;
    }

    // Check if feature exists first (optional validation)
    const feature = await db.selectOne<{
      id: string;
    }>('features', {
      eq: { key: featureKey },
    });

    if (!feature) {
      return false;
    }

    // Then check if it's enabled in plan_features using feature_key
    const planFeature = await db.selectOne<{
      is_enabled: boolean;
    }>('plan_features', {
      eq: { plan_id: planId, feature_key: featureKey },
    });

    return planFeature?.is_enabled || false;
  } catch (error) {
    console.error('Error checking feature status:', error);
    return false;
  }
}

/**
 * Enable or disable a feature for a plan
 * Uses feature_key directly (no need to find feature_id first)
 */
export async function setPlanFeature(
  planName: PlanName,
  featureKey: string,
  isEnabled: boolean
): Promise<boolean> {
  try {
    const planId = await getPlanIdFromName(planName);
    if (!planId) {
      console.error(`Plan not found: ${planName}`);
      return false;
    }

    // Verify feature exists (optional validation)
    const feature = await db.selectOne<{
      id: string;
    }>('features', {
      eq: { key: featureKey },
    });

    if (!feature) {
      console.error(`Feature not found: ${featureKey}`);
      return false;
    }

    const existing = await db.selectOne<{
      id: string;
    }>('plan_features', {
      eq: { plan_id: planId, feature_key: featureKey },
    });

    if (!existing) {
      // Create new entry using feature_key
      await db.insertOne('plan_features', {
        plan_id: planId,
        feature_key: featureKey,
        is_enabled: isEnabled,
      });
    } else {
      // Update existing entry
      await db.updateOne(
        'plan_features',
        { is_enabled: isEnabled },
        { id: existing.id }
      );
    }

    return true;
  } catch (error) {
    console.error('Error setting plan feature:', error);
    return false;
  }
}

/**
 * Update multiple features for a plan at once
 */
export async function updatePlanFeatures(
  planName: PlanName,
  features: Record<string, boolean>
): Promise<boolean> {
  try {
    for (const [featureKey, isEnabled] of Object.entries(features)) {
      await setPlanFeature(planName, featureKey as string, isEnabled);
    }
    return true;
  } catch (error) {
    console.error('Error updating plan features:', error);
    return false;
  }
}

/**
 * Get features grouped by category for a plan
 */
export async function getPlanFeaturesByCategory(planName: PlanName): Promise<Record<string, Array<Feature & { isEnabled: boolean }>>> {
  try {
    const featuresWithStatus = await getAllPlanFeaturesWithStatus(planName);
    
    const grouped: Record<string, Array<Feature & { isEnabled: boolean }>> = {};
    
    featuresWithStatus.forEach(feature => {
      if (!grouped[feature.category]) {
        grouped[feature.category] = [];
      }
      grouped[feature.category].push(feature);
    });

    return grouped;
  } catch (error) {
    console.error('Error grouping plan features by category:', error);
    return {};
  }
}

/**
 * Get enabled feature keys for a plan as a Set
 * Returns a Set of feature keys that are enabled for the given plan
 * Uses feature_key directly (no join needed)
 */
export async function getEnabledPlanFeatures(planName: PlanName): Promise<Set<string>> {
  try {
    const planId = await getPlanIdFromName(planName);
    if (!planId) {
      console.error(`Plan not found: ${planName}`);
      return new Set();
    }

    // Get plan_features with feature_key (direct access, no join needed)
    const planFeatures = await db.select<{
      feature_key: string;
    }>('plan_features', {
      eq: { plan_id: planId, is_enabled: true },
    });

    // Extract feature keys directly (no need to join with features table)
    const featureKeys = planFeatures.map(pf => pf.feature_key);

    return new Set(featureKeys);
  } catch (error) {
    console.error('Error fetching enabled plan features:', error);
    return new Set();
  }
}

