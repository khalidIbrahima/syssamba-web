/**
 * Hook to check if user has permission to access a specific tab
 * Useful for protecting tab content in pages
 */

import { useAccess } from './use-access';
import { getObjectTypeFromPermission } from '@/lib/permission-mappings';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

interface TabPermissionConfig {
  tab: string;
  permission?: string;
  objectType?: ObjectType;
  objectAction?: 'read' | 'create' | 'edit' | 'delete';
  featureKey?: string;
}

/**
 * Check if user can access a specific tab
 * @param tabConfig - Configuration for the tab permission check
 * @returns boolean indicating if user has access
 */
export function useTabPermission(tabConfig: TabPermissionConfig): boolean {
  const { hasFeature, canAccessObject, canPerformAction } = useAccess();
  const { tab, permission, objectType, objectAction, featureKey } = tabConfig;

  // If feature is required, check it first
  if (featureKey && !hasFeature(featureKey)) {
    return false;
  }

  // If objectType and objectAction are specified, use object-level permission check
  if (objectType && objectAction) {
    return canAccessObject(objectType, objectAction);
  }

  // If a specific permission is specified, check it
  if (permission) {
    // Map permission to object type for access checking
    const mappedObjectType = getObjectTypeFromPermission(permission);
    if (mappedObjectType) {
      return canAccessObject(mappedObjectType, 'read');
    }
    return canPerformAction(permission);
  }

  // If no specific permission, default to true (inherit from parent)
  return true;
}

/**
 * Get tab permission configuration from navigation items
 * Helper function to extract tab config from sidebar navigation
 */
export function getTabPermissionConfig(
  navigationItems: Array<{ subItems?: Array<TabPermissionConfig> }>,
  tab: string
): TabPermissionConfig | null {
  for (const item of navigationItems) {
    if (item.subItems) {
      const subItem = item.subItems.find((si) => si.tab === tab);
      if (subItem) {
        return subItem;
      }
    }
  }
  return null;
}

