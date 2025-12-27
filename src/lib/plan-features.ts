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
  feature: Feature | null;
}

/**
 * Get all features (reference table)
 * Uses actual Supabase schema: name (key), display_name, etc.
 */
export async function getAllFeatures(): Promise<Feature[]> {
  try {
    const features = await db.select<{
      id: string;
      name: string; // This is the feature key (e.g., "properties.view")
      display_name: string;
      description: string | null;
      category: string;
      is_premium: boolean;
      is_beta: boolean;
      required_plan: string | null;
      created_at: Date;
      updated_at: Date;
    }>('features', {
      filter: { is_active: true },
      orderBy: { column: 'category', ascending: true },
    });

    return features.map(f => ({
      id: f.id,
      key: f.name, // Use name as key
      name: f.display_name, // Use display_name as name
      description: f.description,
      category: f.category,
      icon: null, // Not in current schema
      isActive: true,
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
      name: string; // Feature key
      display_name: string;
      description: string | null;
      category: string;
      is_premium: boolean;
      is_beta: boolean;
      required_plan: string | null;
      created_at: Date;
      updated_at: Date;
    }>('features', {
      eq: { category },
      filter: { is_active: true },
      orderBy: { column: 'display_name', ascending: true },
    });

    return features.map(f => ({
      id: f.id,
      key: f.name, // Use name as key
      name: f.display_name, // Use display_name as name
      description: f.description,
      category: f.category,
      icon: null, // Not in current schema
      isActive: true,
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

    // Get plan_features with feature_id (not feature_key)
    const planFeatures = await db.select<{
      id: string;
      plan_id: string;
      feature_id: string;
      is_enabled: boolean;
      limits: Record<string, any> | null;
      created_at: Date;
    }>('plan_features', {
      eq: { plan_id: planId, is_enabled: true },
    });

    // Fetch feature details for each plan feature using feature_id
    const featuresWithDetails: PlanFeatureWithDetails[] = [];
    
    for (const pf of planFeatures) {
      const feature = await db.selectOne<{
        id: string;
        name: string; // This is the feature key (e.g., "properties.view")
        display_name: string;
        description: string | null;
        category: string;
        is_premium: boolean;
        is_beta: boolean;
        required_plan: string | null;
        created_at: Date;
        updated_at: Date;
      }>('features', {
        eq: { id: pf.feature_id },
      });

      if (feature) {
        featuresWithDetails.push({
          id: pf.id,
          planName: planName,
          featureKey: feature.name, // Use feature.name as the key
          isEnabled: pf.is_enabled,
          createdAt: pf.created_at,
          updatedAt: feature.updated_at,
          feature: {
            id: feature.id,
            key: feature.name,
            name: feature.display_name,
            description: feature.description,
            category: feature.category,
            icon: null, // Not in current schema
            isActive: true, // Assume active if in plan_features
            createdAt: feature.created_at,
            updatedAt: feature.updated_at,
          },
        });
      }
    }

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
 * Uses feature_id to join with features table
 */
export async function getAllPlanFeaturesWithStatus(planName: PlanName): Promise<Array<Feature & { isEnabled: boolean }>> {
  try {
    const planId = await getPlanIdFromName(planName);
    if (!planId) {
      console.error(`Plan not found: ${planName}`);
      return [];
    }

    // Get all features from features table
    const allFeatures = await db.select<{
      id: string;
      name: string; // This is the feature key
      display_name: string;
      description: string | null;
      category: string;
      is_premium: boolean;
      is_beta: boolean;
      required_plan: string | null;
      created_at: Date;
      updated_at: Date;
    }>('features', {
      filter: { is_active: true },
      orderBy: { column: 'category', ascending: true },
    });
    
    // Get enabled features for this plan using feature_id
    const enabledPlanFeatures = await db.select<{
      feature_id: string;
    }>('plan_features', {
      eq: { plan_id: planId, is_enabled: true },
    });

    const enabledFeatureIds = new Set(enabledPlanFeatures.map(f => f.feature_id));

    // Map features with their enabled status
    return allFeatures.map(feature => ({
      id: feature.id,
      key: feature.name, // Use name as key
      name: feature.display_name,
      description: feature.description,
      category: feature.category,
      icon: null, // Not in current schema
      isActive: true,
      createdAt: feature.created_at,
      updatedAt: feature.updated_at,
      isEnabled: enabledFeatureIds.has(feature.id),
    }));
  } catch (error) {
    console.error('Error fetching plan features with status:', error);
    return [];
  }
}

/**
 * Check if a specific feature is enabled for a plan
 * Uses feature_id by first finding the feature by name (key)
 */
export async function isFeatureEnabled(planName: PlanName, featureKey: string): Promise<boolean> {
  try {
    const planId = await getPlanIdFromName(planName);
    if (!planId) {
      return false;
    }

    // First, find the feature by name (which is the key)
    const feature = await db.selectOne<{
      id: string;
    }>('features', {
      eq: { name: featureKey },
    });

    if (!feature) {
      return false;
    }

    // Then check if it's enabled in plan_features
    const planFeature = await db.selectOne<{
      is_enabled: boolean;
    }>('plan_features', {
      eq: { plan_id: planId, feature_id: feature.id },
    });

    return planFeature?.is_enabled || false;
  } catch (error) {
    console.error('Error checking feature status:', error);
    return false;
  }
}

/**
 * Enable or disable a feature for a plan
 * Uses feature_id by first finding the feature by name (key)
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

    // First, find the feature by name (which is the key)
    const feature = await db.selectOne<{
      id: string;
    }>('features', {
      eq: { name: featureKey },
    });

    if (!feature) {
      console.error(`Feature not found: ${featureKey}`);
      return false;
    }

    const existing = await db.selectOne<{
      id: string;
    }>('plan_features', {
      eq: { plan_id: planId, feature_id: feature.id },
    });

    if (!existing) {
      // Create new entry
      await db.insertOne('plan_features', {
        plan_id: planId,
        feature_id: feature.id,
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
 * Returns a Set of feature keys (feature.name) that are enabled for the given plan
 * Uses feature_id to join with features table
 */
export async function getEnabledPlanFeatures(planName: PlanName): Promise<Set<string>> {
  try {
    const planId = await getPlanIdFromName(planName);
    if (!planId) {
      console.error(`Plan not found: ${planName}`);
      return new Set();
    }

    // Get plan_features with feature_id
    const planFeatures = await db.select<{
      feature_id: string;
    }>('plan_features', {
      eq: { plan_id: planId, is_enabled: true },
    });

    // Get feature names (keys) for each feature_id
    const featureKeys: string[] = [];
    for (const pf of planFeatures) {
      const feature = await db.selectOne<{
        name: string; // This is the feature key
      }>('features', {
        eq: { id: pf.feature_id },
      });
      
      if (feature) {
        featureKeys.push(feature.name);
      }
    }

    return new Set(featureKeys);
  } catch (error) {
    console.error('Error fetching enabled plan features:', error);
    return new Set();
  }
}

