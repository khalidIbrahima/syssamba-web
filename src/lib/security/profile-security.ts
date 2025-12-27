/**
 * Level 2: Profile Security
 * Checks if user's profile allows a specific action on an object type
 */

import type { ObjectType } from '../salesforce-inspired-security';
import type { Action } from './index';
import { getProfileObjectPermissions, getProfileFieldPermissions } from '../profiles';

export interface ProfilePermission {
  objectType: ObjectType;
  accessLevel: 'None' | 'Read' | 'ReadWrite' | 'All';
  canCreate: boolean;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewAll: boolean;
}

/**
 * Check if profile allows an action on an object type
 */
export async function checkProfilePermission(
  profileId: string,
  objectType: ObjectType,
  action: Action
): Promise<boolean> {
  try {
    const permissions = await getProfileObjectPermissions(profileId);
    const permission = permissions.find(p => p.objectType === objectType);
    
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
  } catch (error) {
    console.error('Error checking profile permission:', error);
    return false;
  }
}

/**
 * Check if profile allows field access
 */
export async function checkProfileFieldPermission(
  profileId: string,
  objectType: ObjectType,
  fieldName: string,
  action: 'read' | 'edit'
): Promise<boolean> {
  try {
    const fieldPermissions = await getProfileFieldPermissions(profileId);
    const permission = fieldPermissions.find(
      p => p.objectType === objectType && p.fieldName === fieldName
    );

    if (!permission) {
      // If no specific permission, check object-level permission
      return await checkProfilePermission(
        profileId,
        objectType,
        action === 'read' ? 'read' : 'edit'
      );
    }

    if (action === 'read') {
      return permission.canRead;
    } else {
      return permission.canEdit;
    }
  } catch (error) {
    console.error('Error checking profile field permission:', error);
    return false;
  }
}

/**
 * Get all object permissions for a profile
 */
export async function getProfilePermissions(profileId: string): Promise<ProfilePermission[]> {
  try {
    return await getProfileObjectPermissions(profileId);
  } catch (error) {
    console.error('Error getting profile permissions:', error);
    return [];
  }
}

