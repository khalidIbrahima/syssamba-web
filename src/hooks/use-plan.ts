'use client';

import { useDataQuery } from '@/hooks/use-query';
import { 
  getPlanLimits, 
  getPlanDefinition,
  canAccess, 
  canAccessFeature,
  isLimitExceeded,
  isExtranetLimitExceeded,
  isLotsLimitExceeded,
  isUsersLimitExceeded,
  hasUnlimitedExtranet,
  supportsCustomDomain,
  supportsWhiteLabel,
  getSupportLevel,
  type PlanName,
  type PlanDefinition,
  type PlanLimits,
} from '@/lib/permissions';

// Fetch organization plan data from API
async function getOrganizationPlan(): Promise<{ 
  plan: PlanName; 
  limits: PlanLimits;
  definition: PlanDefinition;
  currentUsage: {
    lots: number;
    users: number;
    extranetTenants: number;
  };
}> {
  try {
    const response = await fetch('/api/organization/plan', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use statusText
      }
      
      console.error('[usePlan] API response not OK:', response.status, errorMessage);
      
      // For 401 (Unauthorized), we should not continue - user needs to authenticate
      if (response.status === 401) {
        throw new Error('Unauthorized: Please sign in to continue');
      }
      
      // For 404 (Not Found), user might not have an organization yet - API handles this gracefully now
      if (response.status === 404) {
        console.log('[usePlan] User has no organization, API returned freemium data');
        // The API now returns freemium data directly, so this shouldn't happen
        // But keeping fallback just in case
        const plan: PlanName = 'freemium';
        const limits = await getPlanLimits(plan);
        const definition = await getPlanDefinition(plan);
        return {
          plan,
          limits,
          definition,
          currentUsage: {
            lots: 0,
            users: 1, // Current user
            extranetTenants: 0,
          },
        };
      }
      
      // For other errors (500, etc.), use fallback but log the error
      console.warn('[usePlan] API error, using freemium fallback');
      const plan: PlanName = 'freemium';
      const limits = await getPlanLimits(plan);
      const definition = await getPlanDefinition(plan);
      return {
        plan,
        limits,
        definition,
        currentUsage: {
          lots: 0,
          users: 0,
          extranetTenants: 0,
        },
      };
    }

    const data = await response.json();
    
    // Validate that we have real data from DB
    if (!data || !data.limits || typeof data.limits.extranetTenants === 'undefined') {
      console.warn('[usePlan] Invalid data from API, using fallback from DB');
      const plan: PlanName = data?.plan || 'freemium';
      const limits = await getPlanLimits(plan);
      const definition = await getPlanDefinition(plan);
      return {
        plan,
        limits,
        definition,
        currentUsage: data?.currentUsage || {
          lots: 0,
          users: 0,
          extranetTenants: 0,
        },
      };
    }
    
    console.log('[usePlan] Successfully fetched plan data from API:', {
      plan: data.plan,
      extranetTenants: data.limits.extranetTenants,
      lots: data.limits.lots,
    });
    
    return data;
  } catch (error) {
    console.error('[usePlan] Error fetching organization plan:', error);
    // Fallback: get plan from DB directly
    const plan: PlanName = 'freemium';
    const limits = await getPlanLimits(plan);
    const definition = await getPlanDefinition(plan);
    return {
      plan,
      limits,
      definition,
      currentUsage: {
        lots: 0,
        users: 0,
        extranetTenants: 0,
      },
    };
  }
}

export function usePlan() {
  // Use useDataQuery instead of useQuery directly to ensure proper QueryClient setup
  const { data, isLoading, error } = useDataQuery(
    ['organization-plan'],
    getOrganizationPlan,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Use data from API (which comes from DB) if available
  // Only use fallback if data is completely missing (not just undefined properties)
  const plan: PlanName = data?.plan || 'freemium';
  
  // If data exists but limits might be incomplete, we still use what we have
  // The API should always return complete data from DB
  const limits: PlanLimits = data?.limits ? {
    lots: data.limits.lots ?? -1,
    users: data.limits.users ?? -1,
    extranetTenants: data.limits.extranetTenants ?? -1,
  } : {
    lots: -1,
    users: -1,
    extranetTenants: -1,
  };
  
  const definition: PlanDefinition = data?.definition || {
    name: plan,
    price: 0,
    lots_limit: null,
    users_limit: null,
    extranet_tenants_limit: null,
    features: {} as PlanDefinition['features'],
  };
  
  const currentUsage = data?.currentUsage || {
    lots: 0,
    users: 0,
    extranetTenants: 0,
  };

  return {
    plan,
    limits,
    definition,
    currentUsage,
    canAccess: async (feature: string) => await canAccess(feature, plan),
    canAccessFeature: async (feature: keyof PlanDefinition['features']) => 
      await canAccessFeature(plan, feature as keyof PlanDefinition['features']),
    isLimitExceeded: (currentCount: number, limitType: keyof PlanLimits) =>
      isLimitExceeded(currentCount, limits[limitType]),
    isExtranetLimitExceeded: async () => 
      await isExtranetLimitExceeded(currentUsage.extranetTenants, plan),
    isLotsLimitExceeded: async () => 
      await isLotsLimitExceeded(currentUsage.lots, plan),
    isUsersLimitExceeded: async () => 
      await isUsersLimitExceeded(currentUsage.users, plan),
    hasUnlimitedExtranet: async () => await hasUnlimitedExtranet(plan),
    supportsCustomDomain: async () => await supportsCustomDomain(plan),
    supportsWhiteLabel: async () => await supportsWhiteLabel(plan),
    getSupportLevel: async () => await getSupportLevel(plan),
    isLoading,
    error,
  };
}