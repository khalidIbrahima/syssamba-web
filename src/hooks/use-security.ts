/**
 * useSecurity Hook
 * Client-side hook for security checks
 * Combines plan, profile, object, and field security
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { usePlan } from './use-plan';
import { useAccess } from './use-access';
import { useUser } from './use-user';

export interface SecurityCheckOptions {
  featureKey?: string;
  objectType?: string;
  objectId?: string;
  action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll';
  fieldName?: string;
}

/**
 * Check security via API
 */
async function checkSecurityAPI(options: SecurityCheckOptions): Promise<{
  allowed: boolean;
  reason?: string;
  failedLevel?: string;
}> {
  const response = await fetch('/api/security/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    return { allowed: false, reason: 'Security check failed' };
  }

  return response.json();
}

export function useSecurity() {
  const { plan, isLoading: planLoading } = usePlan();
  const { 
    hasFeature, 
    hasPermission, 
    canAccessObject,
    isLoading: accessLoading 
  } = useAccess();
  const { user, isLoaded: userLoaded } = useUser();

  /**
   * Check if user can access a feature
   * Level 1: Plan feature check
   * Level 2: Profile permission check (if objectType provided)
   */
  const canAccessFeature = (
    featureKey: string,
    objectType?: string,
    requiredPermission?: string
  ): boolean => {
    // Level 1: Check if feature is enabled in plan
    if (!hasFeature(featureKey)) {
      return false;
    }

    // Level 2: Check profile permission if required
    if (requiredPermission && !hasPermission(requiredPermission)) {
      return false;
    }

    return true;
  };

  /**
   * Check if user can perform an action on an object type
   * Level 1: Plan feature check
   * Level 2: Profile permission check
   */
  const canPerformAction = (
    objectType: string,
    action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll'
  ): boolean => {
    // Level 1: Check if feature is enabled (map object type to feature)
    const featureMap: Record<string, string> = {
      Property: 'properties_management',
      Unit: 'units_management',
      Tenant: 'tenants_full',
      Lease: 'leases_full',
      Payment: 'payments_all_methods',
      Task: 'tasks_full',
    };

    const featureKey = featureMap[objectType];
    if (featureKey && !hasFeature(featureKey)) {
      return false;
    }

    // Level 2: Check profile permission
    // Map 'viewAll' action to 'read' for canAccessObject check
    const mappedAction = action === 'viewAll' ? 'read' : action as 'read' | 'create' | 'edit' | 'delete';
    return canAccessObject(objectType as any, mappedAction);
  };

  /**
   * Check if user can access a specific object instance
   * This requires a server-side check (Level 3: Object Security)
   */
  const useObjectInstanceAccess = (
    objectType: string,
    objectId: string,
    action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll'
  ) => {
    const { data, isLoading } = useQuery({
      queryKey: ['security-check', objectType, objectId, action],
      queryFn: () => checkSecurityAPI({
        objectType,
        objectId,
        action,
      }),
      enabled: !!objectId && !!objectType,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return {
      allowed: data?.allowed || false,
      isLoading,
      reason: data?.reason,
    };
  };

  return {
    // Quick checks (client-side, levels 1-2)
    canAccessFeature,
    canPerformAction,
    
    // Full check (server-side, all levels)
    useObjectInstanceAccess,
    
    // Direct access to underlying hooks
    hasFeature,
    hasPermission,
    canAccessObject,
    
    // Loading states
    isLoading: planLoading || accessLoading || !userLoaded,
    
    // Context
    plan,
    profileId: null, // Will be populated from useAccess
    userId: user?.id || null,
  };
}
