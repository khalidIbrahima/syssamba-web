/**
 * Feature Check Utilities
 * Utility functions for checking features in non-component contexts
 */

import { useFeatures } from '@/contexts/FeatureContext';

/**
 * Hook to check if a feature is enabled and handle accordingly
 * 
 * @example
 * const { canAccess, isLoading } = useFeatureCheck('advanced_analytics');
 * if (canAccess) {
 *   // Show advanced analytics
 * }
 */
export function useFeatureCheck(featureName: string) {
  const { isFeatureEnabled, isLoading, plan } = useFeatures();
  
  return {
    canAccess: isFeatureEnabled(featureName),
    isLoading,
    plan,
  };
}

/**
 * Hook to check feature limits
 * 
 * @example
 * const { limit, hasLimit } = useFeatureLimit('property_management', 'max_properties');
 * if (currentCount >= limit) {
 *   toast.error(`Vous avez atteint la limite de ${limit} propriétés`);
 * }
 */
export function useFeatureLimit(featureName: string, limitKey: string) {
  const { getFeatureLimit, isFeatureEnabled } = useFeatures();
  
  const limit = getFeatureLimit(featureName, limitKey);
  
  return {
    limit,
    hasLimit: limit !== null && limit !== undefined,
    isEnabled: isFeatureEnabled(featureName),
  };
}

/**
 * Hook to check if user has reached a feature limit
 * 
 * @example
 * const { canAdd, remaining } = useFeatureLimitCheck('property_management', 'max_properties', currentCount);
 */
export function useFeatureLimitCheck(
  featureName: string,
  limitKey: string,
  currentCount: number
) {
  const { limit, hasLimit } = useFeatureLimit(featureName, limitKey);
  
  if (!hasLimit || limit === null) {
    return {
      canAdd: true,
      remaining: Infinity,
      limit: null,
    };
  }
  
  return {
    canAdd: currentCount < limit,
    remaining: Math.max(0, limit - currentCount),
    limit,
  };
}

