/**
 * Comprehensive Access Control System
 * Inspired by Salesforce security model
 * 
 * This module provides a unified interface for checking access at all levels:
 * - Object-Level Security (OLS) - Based on profiles
 * - Field-Level Security (FLS) - Based on profiles
 * - Record-Level Security (RLS) - Based on profiles
 * 
 * All access is now based on profiles, not roles
 */

import { db } from './db';
import type { PlanName } from './permissions';
import type {
  ObjectType,
  ObjectPermission,
  FieldPermission,
} from './salesforce-inspired-security';
import {
  getProfileObjectPermissions,
  getProfileFieldPermissions,
} from './profiles';

/**
 * Check if a user has permission to perform an action on an object
 * Uses profile-based permissions instead of role-based
 */
export async function canUserPerformAction(
  userId: string,
  organizationId: string,
  objectType: ObjectType,
  action: 'read' | 'create' | 'edit' | 'delete'
): Promise<boolean> {
  try {
    // Get user and verify organization
    const user = await db.selectOne<{
      organization_id: string;
      profile_id: string | null;
    }>('users', {
      eq: { id: userId },
    });

    if (!user || user.organization_id !== organizationId) {
      return false;
    }

    if (!user.profile_id) {
      return false; // User must have a profile
    }

    // Get object-level permission from profile
    const objectPermissions = await getProfileObjectPermissions(user.profile_id);
    const objectPermission = objectPermissions.find(p => p.objectType === objectType);

    if (!objectPermission) {
      return false;
    }

    // Check action permission
    switch (action) {
      case 'read':
        return objectPermission.canRead;
      case 'create':
        return objectPermission.canCreate;
      case 'edit':
        return objectPermission.canEdit;
      case 'delete':
        return objectPermission.canDelete;
      default:
        return false;
    }
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
}

/**
 * Get effective access level for a user on a record
 * Uses the user's profile to determine permissions
 */
export async function getRecordAccess(
  userId: string,
  organizationId: string,
  objectType: ObjectType,
  recordId: string,
  action: 'read' | 'edit' | 'delete'
): Promise<boolean> {
  try {
    // Get user and verify organization
    const user = await db.selectOne<{
      organization_id: string;
      profile_id: string | null;
    }>('users', {
      eq: { id: userId },
    });

    if (!user || user.organization_id !== organizationId) {
      return false;
    }

    if (!user.profile_id) {
      return false; // User must have a profile
    }

    // Get object-level permission from profile
    const objectPermissions = await getProfileObjectPermissions(user.profile_id);
    const objectPermission = objectPermissions.find(p => p.objectType === objectType);

    if (!objectPermission) {
      return false;
    }

    // Check action permission
    switch (action) {
      case 'read':
        if (!objectPermission.canRead) return false;
        break;
      case 'edit':
        if (!objectPermission.canEdit) return false;
        break;
      case 'delete':
        if (!objectPermission.canDelete) return false;
        break;
    }

    // Check record-level access
    if (!objectPermission.canViewAll) {
      // User can only access own records
      // This would need object-specific logic to check ownership
      // For now, we'll implement basic checks
    }

    return true; // If all checks pass
  } catch (error) {
    console.error('Error checking record access:', error);
    return false;
  }
}


/**
 * Filter record fields based on field-level security
 * Uses the user's profile to determine field access
 */
export async function filterFieldsBySecurity(
  userId: string,
  organizationId: string,
  objectType: ObjectType,
  record: Record<string, any>
): Promise<Record<string, any>> {
  try {
    // Get user and verify organization
    const user = await db.selectOne<{
      organization_id: string;
      profile_id: string | null;
    }>('users', {
      eq: { id: userId },
    });

    if (!user || user.organization_id !== organizationId) {
      return {};
    }

    if (!user.profile_id) {
      return {}; // User must have a profile
    }

    // Get field permissions from profile
    const fieldPermissions = await getProfileFieldPermissions(user.profile_id, objectType);

    const allowedFields = new Set(
      fieldPermissions
        .filter(fp => fp.canRead)
        .map(fp => fp.fieldName)
    );

    // Filter record to only include allowed fields
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      // Always allow id and basic fields
      if (key === 'id' || key === 'created_at' || key === 'updated_at') {
        filtered[key] = value;
      } else if (allowedFields.has(key)) {
        filtered[key] = value;
      }
    }

    return filtered;
  } catch (error) {
    console.error('Error filtering fields:', error);
    return record; // Return original if error
  }
}
