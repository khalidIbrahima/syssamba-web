/**
 * Global Administrator Utilities
 * Functions to check and manage Global Administrator access
 */

import { db } from './db';

/**
 * Check if a user has the Global Administrator profile
 */
export async function isGlobalAdmin(userId: string): Promise<boolean> {
  try {
    // Get user's profile
    const user = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: userId },
    });

    if (!user?.profile_id) {
      return false;
    }

    // Check if the profile is Global Administrator
    const profile = await db.selectOne<{
      name: string;
      organization_id: string | null;
    }>('profiles', {
      eq: { id: user.profile_id },
    });

    return profile?.name === 'Global Administrator' && profile.organization_id === null;
  } catch (error) {
    console.error('Error checking Global Administrator status:', error);
    return false;
  }
}

/**
 * Get Global Administrator profile ID
 */
export async function getGlobalAdminProfileId(): Promise<string | null> {
  try {
    const profile = await db.selectOne<{
      id: string;
    }>('profiles', {
      eq: { 
        name: 'Global Administrator',
        organization_id: null,
      },
    });

    return profile?.id || null;
  } catch (error) {
    console.error('Error fetching Global Administrator profile:', error);
    return null;
  }
}

