'use client';

/**
 * Profile Permissions Context
 * Provides access to user's profile permissions throughout the application
 */

import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useDataQuery } from '@/hooks/use-query';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

export interface UserPermission {
  userId: string;
  profileId: string | null;
  profileName: string | null;
  objectType: ObjectType;
  accessLevel: 'None' | 'Read' | 'ReadWrite' | 'All';
  canCreate: boolean;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewAll: boolean;
}

interface ProfilePermissionsContextValue {
  permissions: UserPermission[];
  profileName: string | null;
  isLoading: boolean;
  error: Error | null;
  canAccessObject: (objectType: ObjectType, action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll') => boolean;
  getPermission: (objectType: ObjectType) => UserPermission | null;
  hasPermission: (objectType: ObjectType, action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll') => boolean;
}

const ProfilePermissionsContext = createContext<ProfilePermissionsContextValue | undefined>(undefined);

// Fetch user's permissions
async function fetchUserPermissions() {
  const response = await fetch('/api/user/permissions', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user permissions');
  }

  const data = await response.json();
  return data;
}

interface ProfilePermissionsProviderProps {
  children: ReactNode;
}

export function ProfilePermissionsProvider({ children }: ProfilePermissionsProviderProps) {
  const { data, isLoading, error } = useDataQuery(
    ['user-permissions'],
    fetchUserPermissions,
    {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    }
  );

  const permissions: UserPermission[] = useMemo(() => {
    return data?.permissions || [];
  }, [data]);

  const profileName = useMemo(() => {
    return permissions.length > 0 ? permissions[0].profileName : null;
  }, [permissions]);

  // Get permission for a specific object type
  const getPermission = useCallback((objectType: ObjectType): UserPermission | null => {
    return permissions.find(p => p.objectType === objectType) || null;
  }, [permissions]);

  // Check if user can perform an action on an object type
  const canAccessObject = useCallback((
    objectType: ObjectType,
    action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll'
  ): boolean => {
    const permission = getPermission(objectType);
    if (!permission) {
      return false;
    }

    switch (action) {
      case 'read':
        return permission.canRead;
      case 'create':
        return permission.canCreate;
      case 'edit':
        return permission.canEdit;
      case 'delete':
        return permission.canDelete;
      case 'viewAll':
        return permission.canViewAll && permission.canRead;
      default:
        return false;
    }
  }, [getPermission]);

  // Alias for canAccessObject (for consistency)
  const hasPermission = useCallback((
    objectType: ObjectType,
    action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll'
  ): boolean => {
    return canAccessObject(objectType, action);
  }, [canAccessObject]);

  const value: ProfilePermissionsContextValue = useMemo(() => ({
    permissions,
    profileName,
    isLoading,
    error: error as Error | null,
    canAccessObject,
    getPermission,
    hasPermission,
  }), [permissions, profileName, isLoading, error, canAccessObject, getPermission, hasPermission]);

  return (
    <ProfilePermissionsContext.Provider value={value}>
      {children}
    </ProfilePermissionsContext.Provider>
  );
}

// Hook to use profile permissions
export function useProfilePermissions() {
  const context = useContext(ProfilePermissionsContext);
  if (context === undefined) {
    throw new Error('useProfilePermissions must be used within a ProfilePermissionsProvider');
  }
  return context;
}

// Hook to check a specific permission
export function usePermission(objectType: ObjectType, action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll') {
  const { canAccessObject, isLoading } = useProfilePermissions();
  
  return {
    canAccess: canAccessObject(objectType, action),
    isLoading,
  };
}

