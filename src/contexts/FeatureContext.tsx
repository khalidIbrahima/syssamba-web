'use client';

/**
 * Feature Context - Rebuilt from scratch
 * Provides global access to user's plan features with optimal performance
 */

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useDataQuery } from '@/hooks/use-query';

// Types
type FeatureLimits = Record<string, number | string | boolean | null>;

export interface Feature {
  id: string;
  featureKey: string; // Unique identifier (e.g., "task_management")
  displayName: string; // Human-readable name (e.g., "Gestion des tâches")
  description: string | null;
  category: string;
  isEnabled: boolean;
  limits?: FeatureLimits;
}

export interface UserPlan { 
  id: string;
  name: string;
  displayName: string;
  description: string | null;
}

export interface FeatureContextValue {
  plan: UserPlan | null;
  features: Feature[];
  // Core methods
  hasFeature: (featureKey: string) => boolean;
  isFeatureEnabled: (featureKey: string) => boolean;
  getFeature: (featureKey: string) => Feature | undefined;
  getFeatureLimit: (featureKey: string, limitKey: string) => number | string | boolean | null;
  // State
  isLoading: boolean;
  error: Error | null;
  // Utilities
  getFeaturesByCategory: (category: string) => Feature[];
  getAllEnabledFeatures: () => Feature[];
}

const FeatureContext = createContext<FeatureContextValue | undefined>(undefined);

// Fetch user's plan and features
async function fetchUserPlanFeatures() {
  const response = await fetch('/api/user/plan-features', {
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch plan features' }));
    throw new Error(error.error || 'Failed to fetch plan features');
  }

  const data = await response.json();
  console.log('[FeatureContext] Fetched plan features:', data);
  return data;
}

interface FeatureProviderProps {
  children: ReactNode;
}

export function FeatureProvider({ children }: FeatureProviderProps) {
  const { data, isLoading, error } = useDataQuery(
    ['user-plan-features'],
    fetchUserPlanFeatures,
    {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    }
  );

  const plan: UserPlan | null = data?.plan || null;
  const features: Feature[] = Array.isArray(data?.features) ? data.features : [];

  // Memoize feature map for O(1) lookups
  const featuresMap = useMemo(() => {
    return new Map(features.map((f) => [f.featureKey, f]));
  }, [features]);

  // Check if user has access to a feature (feature exists in plan)
  const hasFeature = (featureKey: string): boolean => {
    return featuresMap.has(featureKey);
  };

  // Check if a feature is enabled
  const isFeatureEnabled = (featureKey: string): boolean => {
    const feature = featuresMap.get(featureKey);
    return feature?.isEnabled ?? false;
  };

  // Get feature object
  const getFeature = (featureKey: string): Feature | undefined => {
    const feature = featuresMap.get(featureKey);
    return feature as Feature | undefined;
  };

  // Get feature limit value
  const getFeatureLimit = (featureKey: string, limitKey: string): number | string | boolean | null => {
    const feature = featuresMap.get(featureKey);
    if (!feature?.limits) return null;
    return feature.limits[limitKey] ?? null;
  };

  // Get features by category
  const getFeaturesByCategory = (category: string): Feature[] => {
    return features.filter((f) => f.category === category);
  };

  // Get all enabled features
  const getAllEnabledFeatures = (): Feature[] => {
    return features.filter((f) => f.isEnabled);
  };

  const value: FeatureContextValue = {
    plan,
    features,
    hasFeature,
    isFeatureEnabled,
    getFeature,
    getFeatureLimit,
    isLoading,
    error,
    getFeaturesByCategory,
    getAllEnabledFeatures,
  };

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

/**
 * Hook to use features context
 * @throws Error if used outside FeatureProvider
 */
export function useFeatures() {
  const context = useContext(FeatureContext);
  if (context === undefined) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
}

/**
 * Hook to check a specific feature
 * Optimized for single feature checks
 */
export function useFeature(featureKey: string) {
  const { isFeatureEnabled, getFeatureLimit, getFeature, isLoading } = useFeatures();
  
  const feature = getFeature(featureKey);
  
  return {
    isEnabled: isFeatureEnabled(featureKey),
    feature,
    getLimit: (limitKey: string) => getFeatureLimit(featureKey, limitKey),
    isLoading,
  };
}
