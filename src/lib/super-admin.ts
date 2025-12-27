/**
 * Super Admin Utilities
 * Functions to check and manage super-admin access
 *
 * Super admins are identified by the is_super_admin column in the users table.
 * There is no separate super_admins table.
 */

import { db } from './db';

/**
 * Check if a user is a super-admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    // Check the is_super_admin column in users table
    const user = await db.selectOne<{ is_super_admin: boolean }>('users', {
      eq: { id: userId },
    });

    return user?.is_super_admin === true;
  } catch (error) {
    console.error('Error checking super-admin status:', error);
    return false;
  }
}

/**
 * Check if the current user is a super-admin
 * Note: This function requires the user to be passed as parameter
 * Use getCurrentAuthUser() from supabase-auth.ts to get the current user first
 */
export async function isCurrentUserSuperAdmin(userId: string): Promise<boolean> {
  try {
    if (!userId) {
      return false;
    }

    return await isSuperAdmin(userId);
  } catch (error) {
    console.error('Error checking current user super-admin status:', error);
    return false;
  }
}

/**
 * Get all super-admins
 */
export async function getAllSuperAdmins() {
  try {
    // Get all users where is_super_admin is true
    const superAdmins = await db.select<{
      id: string;
      sb_user_id: string | null;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      is_super_admin: boolean;
    }>('users', {
      filter: { is_super_admin: true },
    });

    return superAdmins;
  } catch (error) {
    console.error('Error fetching super-admins:', error);
    return [];
  }
}

