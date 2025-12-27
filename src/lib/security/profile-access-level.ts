/**
 * Profile Access Level Analysis
 * Determines the overall access level of a user profile based on their permissions
 */

import type { ObjectType } from '../salesforce-inspired-security';
import { getProfileObjectPermissions, getProfile, type Profile } from '../profiles';
import type { ProfileObjectPermission } from '../profiles';

export type AccessLevel = 'None' | 'Read' | 'ReadWrite' | 'All';

export interface ProfileAccessSummary {
  profileId: string;
  profileName: string;
  overallAccessLevel: AccessLevel;
  objectAccessLevels: Record<ObjectType, AccessLevel>;
  canCreateAny: boolean;
  canEditAny: boolean;
  canDeleteAny: boolean;
  canViewAllAny: boolean;
  totalObjects: number;
  accessibleObjects: number;
  permissions: ProfileObjectPermission[];
}

/**
 * Determine overall access level from object permissions
 */
function determineAccessLevel(permission: ProfileObjectPermission): AccessLevel {
  if (permission.accessLevel === 'All') {
    return 'All';
  }
  if (permission.accessLevel === 'ReadWrite') {
    return 'ReadWrite';
  }
  if (permission.accessLevel === 'Read') {
    return 'Read';
  }
  return 'None';
}

/**
 * Get the most permissive access level from a set of permissions
 */
function getMostPermissiveLevel(levels: AccessLevel[]): AccessLevel {
  if (levels.includes('All')) return 'All';
  if (levels.includes('ReadWrite')) return 'ReadWrite';
  if (levels.includes('Read')) return 'Read';
  return 'None';
}

/**
 * Analyze profile access level
 * Returns a summary of the profile's access capabilities
 */
export async function analyzeProfileAccessLevel(
  profileId: string
): Promise<ProfileAccessSummary | null> {
  try {
    // Get profile info
    const profile = await getProfile(profileId);
    if (!profile) {
      return null;
    }

    // Get all object permissions
    const permissions = await getProfileObjectPermissions(profileId);

    // Analyze each object type
    const objectAccessLevels: Record<string, AccessLevel> = {};
    let canCreateAny = false;
    let canEditAny = false;
    let canDeleteAny = false;
    let canViewAllAny = false;
    const allAccessLevels: AccessLevel[] = [];

    permissions.forEach(permission => {
      const level = determineAccessLevel(permission);
      objectAccessLevels[permission.objectType] = level;
      allAccessLevels.push(level);

      if (permission.canCreate) canCreateAny = true;
      if (permission.canEdit) canEditAny = true;
      if (permission.canDelete) canDeleteAny = true;
      if (permission.canViewAll) canViewAllAny = true;
    });

    // Determine overall access level (most permissive)
    const overallAccessLevel = getMostPermissiveLevel(allAccessLevels);

    // Count accessible objects (objects with at least Read access)
    const accessibleObjects = permissions.filter(
      p => p.canRead || p.accessLevel !== 'None'
    ).length;

    return {
      profileId: profile.id,
      profileName: profile.name,
      overallAccessLevel,
      objectAccessLevels: objectAccessLevels as Record<ObjectType, AccessLevel>,
      canCreateAny,
      canEditAny,
      canDeleteAny,
      canViewAllAny,
      totalObjects: permissions.length,
      accessibleObjects,
      permissions,
    };
  } catch (error) {
    console.error('Error analyzing profile access level:', error);
    return null;
  }
}

/**
 * Get user's profile access level
 * Convenience function that gets profile from userId first
 */
export async function getUserProfileAccessLevel(
  userId: string
): Promise<ProfileAccessSummary | null> {
  try {
    const { db } = await import('../db');
    const user = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: userId },
    });

    if (!user || !user.profile_id) {
      return null;
    }

    return await analyzeProfileAccessLevel(user.profile_id);
  } catch (error) {
    console.error('Error getting user profile access level:', error);
    return null;
  }
}

/**
 * Compare two access levels
 * Returns true if level1 is at least as permissive as level2
 */
export function hasAccessLevelOrHigher(
  level1: AccessLevel,
  level2: AccessLevel
): boolean {
  const hierarchy: AccessLevel[] = ['None', 'Read', 'ReadWrite', 'All'];
  const index1 = hierarchy.indexOf(level1);
  const index2 = hierarchy.indexOf(level2);
  return index1 >= index2;
}

/**
 * Get access level description
 */
export function getAccessLevelDescription(level: AccessLevel): string {
  const descriptions: Record<AccessLevel, string> = {
    None: 'Aucun accès',
    Read: 'Lecture seule',
    ReadWrite: 'Lecture et écriture',
    All: 'Accès complet (lecture, écriture, suppression)',
  };
  return descriptions[level] || 'Inconnu';
}

/**
 * Check if profile has minimum access level for an object type
 */
export async function hasMinimumAccessLevel(
  profileId: string,
  objectType: ObjectType,
  minimumLevel: AccessLevel
): Promise<boolean> {
  try {
    const permissions = await getProfileObjectPermissions(profileId);
    const permission = permissions.find(p => p.objectType === objectType);

    if (!permission) {
      return false;
    }

    const currentLevel = determineAccessLevel(permission);
    return hasAccessLevelOrHigher(currentLevel, minimumLevel);
  } catch (error) {
    console.error('Error checking minimum access level:', error);
    return false;
  }
}

