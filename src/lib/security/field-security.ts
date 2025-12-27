/**
 * Level 4: Field Security (Future Implementation)
 * Checks if user can read/edit specific fields on an object
 * 
 * This is prepared for future implementation
 */

import type { ObjectType } from '../salesforce-inspired-security';
import { getProfileFieldPermissions } from '../profiles';

export interface FieldPermission {
  objectType: ObjectType;
  fieldName: string;
  canRead: boolean;
  canEdit: boolean;
  isSensitive: boolean;
}

/**
 * Check if user can access a specific field
 */
export async function checkFieldAccess(
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
      // If no specific permission, default to allowed (will be restricted by object-level)
      return true;
    }

    if (action === 'read') {
      return permission.canRead;
    } else {
      return permission.canEdit;
    }
  } catch (error) {
    console.error('Error checking field access:', error);
    return false;
  }
}

/**
 * Get all field permissions for an object type
 */
export async function getFieldPermissions(
  profileId: string,
  objectType: ObjectType
): Promise<FieldPermission[]> {
  try {
    const allPermissions = await getProfileFieldPermissions(profileId);
    return allPermissions
      .filter(p => p.objectType === objectType)
      .map(p => ({
        objectType: p.objectType,
        fieldName: p.fieldName,
        canRead: p.canRead,
        canEdit: p.canEdit,
        isSensitive: p.isSensitive,
      }));
  } catch (error) {
    console.error('Error getting field permissions:', error);
    return [];
  }
}

/**
 * Filter object data based on field permissions
 */
export function filterFieldsByPermissions<T extends Record<string, any>>(
  data: T,
  fieldPermissions: FieldPermission[]
): Partial<T> {
  const filtered: Partial<T> = {};

  Object.keys(data).forEach(key => {
    const permission = fieldPermissions.find(p => p.fieldName === key);
    
    // If no permission found, allow read (will be restricted by object-level)
    if (!permission || permission.canRead) {
      filtered[key as keyof T] = data[key];
    }
  });

  return filtered;
}

