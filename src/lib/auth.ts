/**
 * Authentication Utilities
 * Server-side authentication helpers
 */

import { createServerClient } from './supabase/server';
import { db } from './db';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  organizationId: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  profileId: string | null;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Get user from database
    // First try to find by sb_user_id (explicit Supabase link)
    let dbUser = await db.selectOne<{
      id: string;
      sb_user_id: string | null;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      role: string;
      is_active: boolean;
      organization_id: string | null;
      profile_id: string | null;
    }>('users', {
      eq: { sb_user_id: user.id },
    });

    // Fallback: try by id (for backward compatibility)
    if (!dbUser) {
      dbUser = await db.selectOne<{
        id: string;
        sb_user_id: string | null;
        email: string | null;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
        role: string;
        is_active: boolean;
        organization_id: string | null;
        profile_id: string | null;
      }>('users', {
        eq: { id: user.id },
      });
    }

    if (!dbUser) {
      // User exists in auth but not in database - create profile
      const newUser = await db.insertOne<{
        id: string;
        sb_user_id: string | null;
        email: string | null;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
        role: string;
        is_active: boolean;
        organization_id: string | null;
        profile_id: string | null;
      }>('users', {
        id: user.id, // Use Supabase ID as primary key
        sb_user_id: user.id, // Explicit Supabase user ID link
        email: user.email || null,
        phone: user.phone || null,
        first_name: user.user_metadata?.first_name || null,
        last_name: user.user_metadata?.last_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        role: 'viewer',
        is_active: true,
        organization_id: null,
        profile_id: null,
      });

      if (!newUser) return null;

      return {
        id: newUser.id,
        email: newUser.email,
        phone: newUser.phone,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
        organizationId: newUser.organization_id,
        avatarUrl: newUser.avatar_url,
        isActive: newUser.is_active,
        profileId: newUser.profile_id,
      };
    }

    // Update existing user to set sb_user_id if missing
    if (dbUser && !dbUser.sb_user_id) {
      await db.updateOne('users', {
        sb_user_id: user.id,
      }, { id: dbUser.id });
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      phone: dbUser.phone,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      role: dbUser.role,
      organizationId: dbUser.organization_id,
      avatarUrl: dbUser.avatar_url,
      isActive: dbUser.is_active,
      profileId: dbUser.profile_id,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Require authentication - redirects if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

