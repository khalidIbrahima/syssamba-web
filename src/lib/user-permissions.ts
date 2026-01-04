/**
 * Helper functions to check user permissions server-side
 */

import { db } from './db';
import { getUserProfile, getProfileObjectPermissions } from './profiles';
import type { ObjectType } from './salesforce-inspired-security';

/**
 * Check if a user can perform an action on an object type
 * @param userId - User ID
 * @param objectType - Object type to check
 * @param action - Action to check ('read', 'create', 'edit', 'delete', 'viewAll')
 * @returns true if user has permission, false otherwise
 */
export async function canUserAccessObject(
  userId: string,
  objectType: ObjectType,
  action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll'
): Promise<boolean> {
  try {
    // Get user's profile
    const profile = await getUserProfile(userId);
    if (!profile) {
      return false;
    }

    // Get profile permissions
    const permissions = await getProfileObjectPermissions(profile.id);

    // Find permission for this object type
    const permission = permissions.find((p) => p.objectType === objectType);
    if (!permission) {
      return false;
    }

    // Check specific action
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
        return permission.canViewAll;
      default:
        return false;
    }
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
}

