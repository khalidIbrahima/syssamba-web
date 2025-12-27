/**
 * Visibility Helper
 * Utilities to determine UI visibility based on plan features from plan_features table
 */

import type { PlanName } from '../permissions';
import { getEnabledPlanFeatures, getAllPlanFeaturesWithStatus } from '../plan-features';

/**
 * Get all enabled features for a plan (from plan_features table)
 * Returns a Set of feature keys
 */
export async function getPlanEnabledFeatures(planName: PlanName): Promise<Set<string>> {
  return await getEnabledPlanFeatures(planName);
}

/**
 * Check if a feature is visible for a plan
 * Feature is visible if it's enabled in plan_features table
 */
export async function isFeatureVisible(planName: PlanName, featureKey: string): Promise<boolean> {
  const enabledFeatures = await getEnabledPlanFeatures(planName);
  return enabledFeatures.has(featureKey);
}

/**
 * Get all features with their visibility status for a plan
 * Useful for displaying feature lists with enabled/disabled status
 */
export async function getPlanFeaturesVisibility(planName: PlanName): Promise<Record<string, boolean>> {
  const featuresWithStatus = await getAllPlanFeaturesWithStatus(planName);
  const visibility: Record<string, boolean> = {};
  
  featuresWithStatus.forEach(feature => {
    visibility[feature.key] = feature.isEnabled;
  });
  
  return visibility;
}

/**
 * Filter navigation items based on plan features
 * Only returns items where the feature is enabled in plan_features table
 */
export async function filterNavigationByPlan<T extends { featureKey?: string | null }>(
  items: T[],
  planName: PlanName
): Promise<T[]> {
  const enabledFeatures = await getEnabledPlanFeatures(planName);
  
  return items.filter(item => {
    // If no featureKey specified, always show
    if (!item.featureKey) {
      return true;
    }
    
    // Check if feature is enabled in plan
    return enabledFeatures.has(item.featureKey);
  });
}

/**
 * Get feature categories with visibility for a plan
 * Groups features by category and shows which are enabled
 */
export async function getFeatureCategoriesVisibility(planName: PlanName): Promise<Record<string, {
  enabled: string[];
  disabled: string[];
}>> {
  const featuresWithStatus = await getAllPlanFeaturesWithStatus(planName);
  const categories: Record<string, { enabled: string[]; disabled: string[] }> = {};
  
  featuresWithStatus.forEach(feature => {
    if (!categories[feature.category]) {
      categories[feature.category] = { enabled: [], disabled: [] };
    }
    
    if (feature.isEnabled) {
      categories[feature.category].enabled.push(feature.key);
    } else {
      categories[feature.category].disabled.push(feature.key);
    }
  });
  
  return categories;
}

