'use client';

/**
 * Feature Context
 * Provides access to user's plan features throughout the application
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useDataQuery } from '@/hooks/use-query';

interface Feature {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  isEnabled: boolean;
  limits?: any;
}

interface UserPlan {
  id: string;
  name: string;
  displayName: string;
  features: Feature[];
}

interface FeatureContextValue {
  plan: UserPlan | null;
  features: Feature[];
  hasFeature: (featureName: string) => boolean;
  isFeatureEnabled: (featureName: string) => boolean;
  getFeatureLimit: (featureName: string, limitKey: string) => any;
  isLoading: boolean;
  error: Error | null;
}

const FeatureContext = createContext<FeatureContextValue | undefined>(undefined);

// Fetch user's plan and features
async function fetchUserPlanFeatures() {
  const response = await fetch('/api/user/plan-features', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch plan features');
  }

  return response.json();
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
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (renamed from cacheTime in React Query v5)
    }
  );

  const plan = data?.plan || null;
  const features = data?.features || [];

  // Check if user has access to a feature (feature exists in plan)
  const hasFeature = (featureName: string): boolean => {
    return features.some((f: Feature) => f.name === featureName);
  };

  // Check if a feature is enabled
  const isFeatureEnabled = (featureName: string): boolean => {
    const feature = features.find((f: Feature) => f.name === featureName);
    return feature ? feature.isEnabled : false;
  };

  // Get feature limit value
  const getFeatureLimit = (featureName: string, limitKey: string): any => {
    const feature = features.find((f: Feature) => f.name === featureName);
    if (!feature || !feature.limits) return null;
    return feature.limits[limitKey];
  };

  const value: FeatureContextValue = {
    plan,
    features,
    hasFeature,
    isFeatureEnabled,
    getFeatureLimit,
    isLoading,
    error,
  };

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

// Hook to use features
export function useFeatures() {
  const context = useContext(FeatureContext);
  if (context === undefined) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
}

// Hook to check a specific feature
export function useFeature(featureName: string) {
  const { isFeatureEnabled, getFeatureLimit, isLoading } = useFeatures();
  
  return {
    isEnabled: isFeatureEnabled(featureName),
    getLimit: (limitKey: string) => getFeatureLimit(featureName, limitKey),
    isLoading,
  };
}

