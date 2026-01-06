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
      // User exists in auth but not in database - create profile and organization
      
      // Generate organization name from user's name or email
      const firstName = user.user_metadata?.first_name || '';
      const lastName = user.user_metadata?.last_name || '';
      const orgName = `${firstName} ${lastName}`.trim() || user.email?.split('@')[0] || 'My Organization';
      
      // Generate a unique slug and subdomain for the organization
      const baseSlug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50); // Limit length

      let slug = baseSlug;
      let subdomain = baseSlug;
      let counter = 1;

      // Ensure both slug and subdomain uniqueness
      while (true) {
        // Check if slug exists
        const existingBySlug = await db.selectOne<{ id: string }>('organizations', {
          eq: { slug },
        });
        
        // Check if subdomain exists
        const existingBySubdomain = await db.selectOne<{ id: string }>('organizations', {
          eq: { subdomain },
        });

        if (!existingBySlug && !existingBySubdomain) break;

        slug = `${baseSlug}-${counter}`;
        subdomain = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create the organization
      const organization = await db.insertOne<{
        id: string;
        name: string;
        slug: string;
        subdomain: string;
        type: string;
        country: string;
        is_configured: boolean;
        created_at: string;
        updated_at: string;
      }>('organizations', {
        name: orgName,
        slug,
        subdomain,
        type: 'individual', // Default type
        country: 'SN', // Default country (Senegal)
        is_configured: false, // Not fully configured yet
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (!organization) {
        console.error('Failed to create organization in auth fallback.');
        return null;
      }

      // Note: We use existing global system profiles instead of creating organization-specific profiles
      // Global profiles (is_global = TRUE, organization_id = NULL) are shared across all organizations

      // Get System Administrator profile ID (global profile)
      const systemAdminProfile = await db.selectOne<{
        id: string;
        name: string;
      }>('profiles', {
        eq: { name: 'System Administrator', is_global: true },
      });

      if (!systemAdminProfile || !systemAdminProfile.id) {
        console.error('[Auth Fallback] System Administrator profile not found! Cannot assign profile to new user.');
        // Return null to prevent user creation without profile
        return null;
      }

      console.log(`[Auth Fallback] Found System Administrator profile: ${systemAdminProfile.id}`);

      // Create user profile with organization ID
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
        first_name: firstName || null,
        last_name: lastName || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        role: 'owner', // New signups are owners
        is_active: true,
        profile_id: systemAdminProfile.id, // Assign System Administrator profile
        organization_id: organization?.id || null,
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

