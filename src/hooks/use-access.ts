// React hook for access control
// Combines plan features and profile permissions (NOT roles)

import { useQuery } from '@tanstack/react-query';
import { usePlan } from './use-plan';
import type { PlanName } from '@/lib/permissions';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

interface ProfilePermission {
  objectType: ObjectType;
  accessLevel: 'None' | 'Read' | 'ReadWrite' | 'All';
  canCreate: boolean;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewAll: boolean;
}

interface AccessData {
  planName: PlanName;
  profileId: string | null;
  enabledFeatures: string[];
  objectPermissions: ProfilePermission[];
}

// Fetch access information from API
async function getAccessInfo(): Promise<AccessData> {
  const response = await fetch('/api/organization/access', {
    credentials: 'include',
  });

  if (!response.ok) {
    // If 404 or other error, return default data for users without organization
    if (response.status === 404) {
      return {
        planName: 'freemium' as PlanName,
        profileId: null,
        enabledFeatures: [],
        objectPermissions: [],
      };
    }
    throw new Error('Failed to fetch access information');
  }

  return response.json();
}

// Fetch profile permissions from API
async function getProfilePermissions(): Promise<{
  profileId: string | null;
  objectPermissions: ProfilePermission[];
}> {
  const response = await fetch('/api/organization/access-control-data', {
    credentials: 'include',
  });

  if (!response.ok) {
    // If 404 or other error, return default empty permissions
    if (response.status === 404) {
      return {
        profileId: null,
        objectPermissions: [],
      };
    }
    throw new Error('Failed to fetch profile permissions');
  }

  return response.json();
}

// Map object permissions to feature permissions
function mapObjectPermissionsToFeatures(objectPermissions: ProfilePermission[]): Record<string, boolean> {
  const permissions: Record<string, boolean> = {};

  // Map object types to feature permissions
  const objectToFeatureMap: Record<ObjectType, string[]> = {
    Property: ['canViewAllProperties', 'canCreateProperties', 'canEditProperties', 'canDeleteProperties'],
    Unit: ['canViewAllUnits', 'canCreateUnits', 'canEditUnits', 'canDeleteUnits'],
    Tenant: ['canViewAllTenants', 'canCreateTenants', 'canEditTenants', 'canDeleteTenants'],
    Lease: ['canViewAllLeases', 'canCreateLeases', 'canEditLeases', 'canDeleteLeases'],
    Payment: ['canViewAllPayments', 'canCreatePayments', 'canEditPayments', 'canDeletePayments'],
    Task: ['canViewAllTasks', 'canCreateTasks', 'canEditTasks', 'canDeleteTasks'],
    Message: ['canSendMessages', 'canViewAllMessages'],
    JournalEntry: ['canViewAccounting', 'canCreateJournalEntries', 'canEditJournalEntries'],
    User: ['canViewAllUsers', 'canCreateUsers', 'canEditUsers', 'canDeleteUsers'],
    Organization: ['canViewSettings'],
    Profile: ['canViewSettings', 'canManageProfiles', 'canCreateProfiles', 'canEditProfiles', 'canDeleteProfiles'],
    Report: ['canViewReports', 'canCreateReports'],
    Activity: ['canViewActivities'],
  };

  objectPermissions.forEach((perm) => {
    const features = objectToFeatureMap[perm.objectType] || [];
    features.forEach((feature) => {
      if (feature.includes('ViewAll') || feature.includes('View')) {
        permissions[feature] = perm.canRead && perm.canViewAll;
      } else if (feature.includes('Create') || feature.includes('Send')) {
        // Send messages = Create messages
        permissions[feature] = perm.canCreate;
      } else if (feature.includes('Edit')) {
        permissions[feature] = perm.canEdit;
      } else if (feature.includes('Delete')) {
        permissions[feature] = perm.canDelete;
      } else {
        permissions[feature] = perm.canRead;
      }
    });
  });

  // Add common permissions
  permissions.canViewSettings = objectPermissions.some(
    (p) => p.objectType === 'Organization' && p.canRead
  ) || objectPermissions.some(
    (p) => p.objectType === 'User' && p.canRead
  ) || objectPermissions.some(
    (p) => p.objectType === 'Profile' && p.canRead
  );

  return permissions;
}

export function useAccess() {
  const { plan } = usePlan();
  const { data: accessData, isLoading: accessLoading, error: accessError } = useQuery({
    queryKey: ['user-access', plan],
    queryFn: getAccessInfo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!plan,
  });

  const { data: profileData, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['profile-permissions'],
    queryFn: getProfilePermissions,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const enabledFeatures = new Set(accessData?.enabledFeatures || []);
  const objectPermissions = profileData?.objectPermissions || [];
  const permissions = mapObjectPermissionsToFeatures(objectPermissions);

  /**
   * Check if a feature is enabled for the plan
   */
  const hasFeature = (featureKey: string): boolean => {
    return enabledFeatures.has(featureKey);
  };

  /**
   * Check if user has a specific permission (based on profile)
   */
  const hasPermission = (permission: string): boolean => {
    return permissions[permission] || false;
  };

  /**
   * Check if user can access a feature (feature must be enabled AND user must have permission)
   */
  const canAccessFeature = (featureKey: string, requiredPermission?: string): boolean => {
    // First check if feature is enabled
    if (!hasFeature(featureKey)) {
      return false;
    }

    // If a specific permission is required, check it
    if (requiredPermission) {
      return hasPermission(requiredPermission);
    }

    // If no specific permission required, just check if feature is enabled
    return true;
  };

  /**
   * Check if user can perform an action (based on profile permissions)
   */
  const canPerformAction = (permission: string): boolean => {
    return hasPermission(permission);
  };

  /**
   * Check if user can access an object type
   */
  const canAccessObject = (objectType: ObjectType, action: 'read' | 'create' | 'edit' | 'delete' = 'read'): boolean => {
    const permission = objectPermissions.find((p) => p.objectType === objectType);
    if (!permission) return false;

    switch (action) {
      case 'read':
        return permission.canRead;
      case 'create':
        return permission.canCreate;
      case 'edit':
        return permission.canEdit;
      case 'delete':
        return permission.canDelete;
      default:
        return false;
    }
  };

  return {
    planName: accessData?.planName || plan,
    profileId: profileData?.profileId || null,
    enabledFeatures,
    permissions,
    objectPermissions,
    hasFeature,
    hasPermission,
    canAccessFeature,
    canPerformAction,
    canAccessObject,
    isLoading: accessLoading || profileLoading,
    error: accessError || profileError,
  };
}

