/**
 * Hook for managing sidebar navigation item access permissions
 * 
 * This hook provides a centralized way to check if a user can access
 * sidebar navigation items based on:
 * - Feature availability (plan features)
 * - Object-level permissions (profile permissions)
 * - Custom access rules
 */

import { useAccess } from './use-access';
import { useFeatures } from '@/contexts/FeatureContext';
import { getObjectTypeFromPermission } from '@/lib/permission-mappings';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

export interface SidebarItemAccessConfig {
  /** Feature key required for this item (e.g., 'property_management') */
  featureKey?: string | null;
  /** Permission string (e.g., 'canViewAllProperties') */
  permission?: string;
  /** Direct object type check (alternative to permission) */
  objectType?: ObjectType;
  /** Action required on the object (default: 'read') */
  objectAction?: 'read' | 'create' | 'edit' | 'delete';
  /** Multiple permissions (OR logic - user needs at least one) */
  permissions?: string[];
  /** Multiple permissions (AND logic - user needs all) */
  requiredPermissions?: string[];
  /** Custom access check function */
  customCheck?: () => boolean;
  /** Always visible (bypasses all checks) */
  alwaysVisible?: boolean;
}

/**
 * Hook to check if a user can access a sidebar navigation item
 * 
 * @param config - Access configuration for the sidebar item
 * @returns Object with access information and check functions
 * 
 * @example
 * ```tsx
 * const { canAccess, reason } = useSidebarAccess({
 *   featureKey: 'property_management',
 *   permission: 'canViewAllProperties',
 * });
 * 
 * if (!canAccess) {
 *   return null; // Don't show item
 * }
 * ```
 */
export function useSidebarAccess(config: SidebarItemAccessConfig) {
  const { canAccessObject, canPerformAction } = useAccess();
  const { isFeatureEnabled } = useFeatures();

  const {
    featureKey,
    permission,
    objectType,
    objectAction = 'read',
    permissions,
    requiredPermissions,
    customCheck,
    alwaysVisible = false,
  } = config;

  // If always visible, bypass all checks
  if (alwaysVisible) {
    return {
      canAccess: true,
      reason: 'always_visible' as const,
      hasFeature: true,
      hasPermission: true,
    };
  }

  // STEP 1: Check Plan Feature Security Level
  // If featureKey is specified, feature MUST be enabled in the plan
  const hasFeature = featureKey === null || featureKey === undefined || isFeatureEnabled(featureKey);

  // If feature is required but not available, deny access immediately
  if (featureKey && !hasFeature) {
    return {
      canAccess: false,
      reason: 'feature_not_available' as const,
      hasFeature: false,
      hasPermission: false,
    };
  }

  // Custom check function (highest priority)
  if (customCheck) {
    const customResult = customCheck();
    return {
      canAccess: customResult,
      reason: customResult ? 'custom_check_passed' as const : 'custom_check_failed' as const,
      hasFeature,
      hasPermission: customResult,
    };
  }

  // STEP 2: Check Profile Security Level
  // Check object-level permissions (direct objectType)
  if (objectType) {
    const hasObjectAccess = canAccessObject(objectType, objectAction);
    // FINAL CHECK: Both plan feature AND profile permission must be satisfied
    const canAccess = hasFeature && hasObjectAccess;
    return {
      canAccess,
      reason: canAccess 
        ? (hasObjectAccess ? 'object_permission_granted' as const : 'feature_not_available' as const)
        : (hasObjectAccess ? 'feature_not_available' as const : 'object_permission_denied' as const),
      hasFeature,
      hasPermission: hasObjectAccess,
    };
  }

  // Check multiple permissions with AND logic
  if (requiredPermissions && requiredPermissions.length > 0) {
    const allPermissionsGranted = requiredPermissions.every(perm => {
      const objType = getObjectTypeFromPermission(perm);
      if (objType) {
        return canAccessObject(objType, 'read');
      }
      return canPerformAction(perm);
    });

    // FINAL CHECK: Both plan feature AND all profile permissions must be satisfied
    const canAccess = hasFeature && allPermissionsGranted;
    return {
      canAccess,
      reason: canAccess
        ? (allPermissionsGranted ? 'all_permissions_granted' as const : 'feature_not_available' as const)
        : (allPermissionsGranted ? 'feature_not_available' as const : 'missing_required_permissions' as const),
      hasFeature,
      hasPermission: allPermissionsGranted,
    };
  }

  // Check multiple permissions with OR logic
  if (permissions && permissions.length > 0) {
    const anyPermissionGranted = permissions.some(perm => {
      const objType = getObjectTypeFromPermission(perm);
      if (objType) {
        return canAccessObject(objType, 'read');
      }
      return canPerformAction(perm);
    });

    // FINAL CHECK: Both plan feature AND at least one profile permission must be satisfied
    const canAccess = hasFeature && anyPermissionGranted;
    return {
      canAccess,
      reason: canAccess
        ? (anyPermissionGranted ? 'any_permission_granted' as const : 'feature_not_available' as const)
        : (anyPermissionGranted ? 'feature_not_available' as const : 'no_permissions_granted' as const),
      hasFeature,
      hasPermission: anyPermissionGranted,
    };
  }

  // Check single permission
  if (permission) {
    const objType = getObjectTypeFromPermission(permission);
    let hasProfilePermission = false;

    if (objType) {
      hasProfilePermission = canAccessObject(objType, 'read');
    } else {
      hasProfilePermission = canPerformAction(permission);
    }

    // FINAL CHECK: Both plan feature AND profile permission must be satisfied
    const canAccess = hasFeature && hasProfilePermission;
    return {
      canAccess,
      reason: canAccess
        ? (hasProfilePermission ? 'permission_granted' as const : 'feature_not_available' as const)
        : (hasProfilePermission ? 'feature_not_available' as const : 'permission_denied' as const),
      hasFeature,
      hasPermission: hasProfilePermission,
    };
  }

  // SECURITY: If no permission check specified, deny access for security
  // We cannot verify profile security level without a permission
  return {
    canAccess: false,
    reason: 'no_permission_specified' as const,
    hasFeature,
    hasPermission: false,
  };
}

/**
 * Helper function to check access for multiple items
 * Useful for batch filtering
 */
export function useSidebarItemsAccess(items: SidebarItemAccessConfig[]) {
  return items.map(item => ({
    config: item,
    access: useSidebarAccess(item),
  }));
}

