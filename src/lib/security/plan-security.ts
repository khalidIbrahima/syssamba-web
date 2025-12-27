/**
 * Level 1: Plan Features Security
 * Checks if a feature is enabled in the user's subscription plan
 */

import type { PlanName } from '../permissions';
import { getEnabledPlanFeatures } from '../plan-features';

/**
 * Check if a feature is enabled in the plan
 */
export async function checkPlanFeature(
  planName: PlanName,
  featureKey: string
): Promise<boolean> {
  try {
    const enabledFeatures = await getEnabledPlanFeatures(planName);
    return enabledFeatures.has(featureKey);
  } catch (error) {
    console.error('Error checking plan feature:', error);
    return false;
  }
}

/**
 * Check multiple features at once
 */
export async function checkPlanFeatures(
  planName: PlanName,
  featureKeys: string[]
): Promise<Record<string, boolean>> {
  try {
    const enabledFeatures = await getEnabledPlanFeatures(planName);
    const results: Record<string, boolean> = {};
    
    featureKeys.forEach(key => {
      results[key] = enabledFeatures.has(key);
    });
    
    return results;
  } catch (error) {
    console.error('Error checking plan features:', error);
    return featureKeys.reduce((acc, key) => ({ ...acc, [key]: false }), {});
  }
}

/**
 * Get all enabled features for a plan
 */
export async function getPlanFeatures(planName: PlanName): Promise<Set<string>> {
  try {
    return await getEnabledPlanFeatures(planName);
  } catch (error) {
    console.error('Error getting plan features:', error);
    return new Set();
  }
}

