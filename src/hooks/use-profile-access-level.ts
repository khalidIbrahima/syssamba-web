/**
 * useProfileAccessLevel Hook
 * Client-side hook to get user's profile access level
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type { ProfileAccessSummary, AccessLevel } from '@/lib/security/profile-access-level';

async function getProfileAccessLevel(): Promise<ProfileAccessSummary> {
  const response = await fetch('/api/user/profile-access-level', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch profile access level');
  }

  return response.json();
}

export function useProfileAccessLevel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['profile-access-level'],
    queryFn: getProfileAccessLevel,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  /**
   * Check if user has minimum access level for an object type
   */
  const hasMinimumAccessForObject = (
    objectType: string,
    minimumLevel: AccessLevel
  ): boolean => {
    if (!data) return false;
    
    const objectLevel = data.objectAccessLevels[objectType as keyof typeof data.objectAccessLevels];
    if (!objectLevel) return false;

    const hierarchy: AccessLevel[] = ['None', 'Read', 'ReadWrite', 'All'];
    const objectIndex = hierarchy.indexOf(objectLevel);
    const minimumIndex = hierarchy.indexOf(minimumLevel);
    
    return objectIndex >= minimumIndex;
  };

  /**
   * Check if user can perform action on any object
   */
  const canPerformAction = (action: 'create' | 'edit' | 'delete' | 'viewAll'): boolean => {
    if (!data) return false;
    
    switch (action) {
      case 'create':
        return data.canCreateAny;
      case 'edit':
        return data.canEditAny;
      case 'delete':
        return data.canDeleteAny;
      case 'viewAll':
        return data.canViewAllAny;
      default:
        return false;
    }
  };

  /**
   * Get access level for a specific object type
   */
  const getObjectAccessLevel = (objectType: string): AccessLevel => {
    if (!data) return 'None';
    
    return data.objectAccessLevels[objectType as keyof typeof data.objectAccessLevels] || 'None';
  };

  return {
    profileId: data?.profileId || null,
    profileName: data?.profileName || null,
    overallAccessLevel: data?.overallAccessLevel || 'None',
    objectAccessLevels: data?.objectAccessLevels || {},
    canCreateAny: data?.canCreateAny || false,
    canEditAny: data?.canEditAny || false,
    canDeleteAny: data?.canDeleteAny || false,
    canViewAllAny: data?.canViewAllAny || false,
    totalObjects: data?.totalObjects || 0,
    accessibleObjects: data?.accessibleObjects || 0,
    permissions: data?.permissions || [],
    hasMinimumAccessForObject,
    canPerformAction,
    getObjectAccessLevel,
    isLoading,
    error,
  };
}

