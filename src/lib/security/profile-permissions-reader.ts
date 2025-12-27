/**
 * Profile Permissions Reader
 * Reads user permissions from users.profile_id → profiles → profile_object_permissions
 * 
 * Structure:
 * - users.profile_id → references profiles.id
 * - profile_object_permissions is a junction table linking profiles to permissions
 */

import { db } from '../db';
import { getCurrentUser } from '../auth';
import type { ObjectType } from '../salesforce-inspired-security';
import type { Action } from './index';

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

/**
 * Get user's profile ID from users table
 */
export async function getUserProfileId(userId: string): Promise<string | null> {
  try {
    const user = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: userId },
    });

    return user?.profile_id || null;
  } catch (error) {
    console.error('Error getting user profile ID:', error);
    return null;
  }
}

/**
 * Get current user's profile ID
 */
export async function getCurrentUserProfileId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    return await getUserProfileId(user.id);
  } catch (error) {
    console.error('Error getting current user profile ID:', error);
    return null;
  }
}

/**
 * Get all permissions for a user (via their profile)
 * Reads from: users.profile_id → profile_object_permissions
 */
export async function getUserPermissions(userId: string): Promise<UserPermission[]> {
  try {
    // Get user's profile_id
    const profileId = await getUserProfileId(userId);
    if (!profileId) {
      return [];
    }

    // Get profile name
    const profile = await db.selectOne<{
      name: string;
    }>('profiles', {
      eq: { id: profileId },
    });

    // Get permissions from profile_object_permissions (junction table)
    const permissions = await db.select<{
      id: string;
      profile_id: string;
      object_type: string;
      access_level: string;
      can_create: boolean;
      can_read: boolean;
      can_edit: boolean;
      can_delete: boolean;
      can_view_all: boolean;
    }>('profile_object_permissions', {
      eq: { profile_id: profileId },
    });

    return permissions.map(p => ({
      userId,
      profileId,
      profileName: profile?.name || null,
      objectType: p.object_type as ObjectType,
      accessLevel: p.access_level as 'None' | 'Read' | 'ReadWrite' | 'All',
      canCreate: p.can_create,
      canRead: p.can_read,
      canEdit: p.can_edit,
      canDelete: p.can_delete,
      canViewAll: p.can_view_all,
    }));
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Get user's permission for a specific object type
 */
export async function getUserObjectPermission(
  userId: string,
  objectType: ObjectType
): Promise<UserPermission | null> {
  try {
    const permissions = await getUserPermissions(userId);
    return permissions.find(p => p.objectType === objectType) || null;
  } catch (error) {
    console.error('Error getting user object permission:', error);
    return null;
  }
}

/**
 * Check if user can perform an action on an object type
 */
export async function canUserPerformAction(
  userId: string,
  objectType: ObjectType,
  action: Action
): Promise<boolean> {
  try {
    const permission = await getUserObjectPermission(userId, objectType);
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
    console.error('Error checking user action permission:', error);
    return false;
  }
}

/**
 * Get current user's permissions
 */
export async function getCurrentUserPermissions(): Promise<UserPermission[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    return await getUserPermissions(user.id);
  } catch (error) {
    console.error('Error getting current user permissions:', error);
    return [];
  }
}

/**
 * Get current user's permission for a specific object type
 */
export async function getCurrentUserObjectPermission(
  objectType: ObjectType
): Promise<UserPermission | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    return await getUserObjectPermission(user.id, objectType);
  } catch (error) {
    console.error('Error getting current user object permission:', error);
    return null;
  }
}

