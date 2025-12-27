import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from './db';

/**
 * Synchronize Clerk user with database
 * Creates user if doesn't exist, updates if exists
 */
export async function syncUserWithDatabase(clerkUserId: string) {
  try {
    // Get user data from Clerk
    const clerkUser = await currentUser();
    
    if (!clerkUser) {
      return null;
    }

    // Get primary email and phone
    const primaryEmail = clerkUser.emailAddresses?.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;
    
    const primaryPhone = clerkUser.phoneNumbers?.find(
      (phone) => phone.id === clerkUser.primaryPhoneNumberId
    )?.phoneNumber;

    // Check if user exists in database by clerkId
    const existingUser = await db.selectOne<{
      id: string;
      clerk_id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      role: string;
      is_active: boolean;
      organization_id: string | null;
    }>('users', {
      eq: { clerk_id: clerkUserId },
    });

    if (existingUser) {
      // Update existing user
      const updatedUser = await db.updateOne<{
        id: string;
        clerk_id: string;
        email: string | null;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
        role: string;
        is_active: boolean;
        organization_id: string | null;
      }>(
        'users',
        {
          email: primaryEmail || null,
          phone: primaryPhone || null,
          first_name: clerkUser.firstName || null,
          last_name: clerkUser.lastName || null,
          avatar_url: clerkUser.imageUrl || null,
          is_active: true,
        },
        { clerk_id: clerkUserId }
      );

      if (!updatedUser) return null;

      // Map snake_case to camelCase
      return {
        id: updatedUser.id,
        clerkId: updatedUser.clerk_id,
        email: updatedUser.email,
        phone: updatedUser.phone,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        avatarUrl: updatedUser.avatar_url,
        role: updatedUser.role,
        isActive: updatedUser.is_active,
        organizationId: updatedUser.organization_id,
      };
    }

    // Create new user
    const newUser = await db.insertOne<{
      id: string;
      clerk_id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      role: string;
      is_active: boolean;
      organization_id: string | null;
    }>('users', {
      clerk_id: clerkUserId,
        email: primaryEmail || null,
        phone: primaryPhone || null,
      first_name: clerkUser.firstName || null,
      last_name: clerkUser.lastName || null,
      avatar_url: clerkUser.imageUrl || null,
        role: 'viewer', // Default role
      is_active: true,
    });

    if (!newUser) return null;

    // Map snake_case to camelCase
    return {
      id: newUser.id,
      clerkId: newUser.clerk_id,
      email: newUser.email,
      phone: newUser.phone,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      avatarUrl: newUser.avatar_url,
      role: newUser.role,
      isActive: newUser.is_active,
      organizationId: newUser.organization_id,
    };
  } catch (error) {
    console.error('Error syncing user with database:', error);
    return null;
  }
}

/**
 * Get current user from database
 * Automatically syncs with Clerk if user doesn't exist
 */
export async function getCurrentUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // Get user from database
  const user = await db.selectOne<{
    id: string;
    clerk_id: string;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    role: string;
    is_active: boolean;
    organization_id: string | null;
  }>('users', {
    eq: { clerk_id: userId },
  });

  // If user doesn't exist in database, sync from Clerk
  if (!user) {
    return await syncUserWithDatabase(userId);
  }

  // If user exists but is inactive, reactivate and sync
  if (!user.is_active) {
    const clerkUser = await currentUser();
    if (clerkUser) {
      const primaryEmail = clerkUser.emailAddresses?.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      )?.emailAddress;
      
      const primaryPhone = clerkUser.phoneNumbers?.find(
        (phone) => phone.id === clerkUser.primaryPhoneNumberId
      )?.phoneNumber;

      const reactivatedUser = await db.updateOne<{
        id: string;
        clerk_id: string;
        email: string | null;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
        role: string;
        is_active: boolean;
        organization_id: string | null;
      }>(
        'users',
        {
          email: primaryEmail || null,
          phone: primaryPhone || null,
          first_name: clerkUser.firstName || null,
          last_name: clerkUser.lastName || null,
          avatar_url: clerkUser.imageUrl || null,
          is_active: true,
        },
        { clerk_id: userId }
      );

      if (!reactivatedUser) return null;

      // Map snake_case to camelCase
      return {
        id: reactivatedUser.id,
        clerkId: reactivatedUser.clerk_id,
        email: reactivatedUser.email,
        phone: reactivatedUser.phone,
        firstName: reactivatedUser.first_name,
        lastName: reactivatedUser.last_name,
        avatarUrl: reactivatedUser.avatar_url,
        role: reactivatedUser.role,
        isActive: reactivatedUser.is_active,
        organizationId: reactivatedUser.organization_id,
      };
    }
  }

  // Map snake_case to camelCase
  return {
    id: user.id,
    clerkId: user.clerk_id,
    email: user.email,
    phone: user.phone,
    firstName: user.first_name,
    lastName: user.last_name,
    avatarUrl: user.avatar_url,
    role: user.role,
    isActive: user.is_active,
    organizationId: user.organization_id,
  };
}

/**
 * Get current user's organization
 */
export async function getCurrentOrganization() {
  const user = await getCurrentUser();

  if (!user?.organizationId) {
    return null;
  }

  const organization = await db.selectOne<{
    id: string;
    name: string | null;
    slug: string | null;
    type: string;
    country: string;
    extranet_tenants_count: number | null;
    custom_extranet_domain: string | null;
    stripe_customer_id: string | null;
    is_configured: boolean;
    created_at: Date | string;
    updated_at: Date | string;
  }>('organizations', {
    eq: { id: user.organizationId },
  });

  if (!organization) return null;

  // Map snake_case to camelCase
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    type: organization.type,
    country: organization.country,
    extranetTenantsCount: organization.extranet_tenants_count,
    customExtranetDomain: organization.custom_extranet_domain,
    stripeCustomerId: organization.stripe_customer_id,
    isConfigured: organization.is_configured,
    createdAt: organization.created_at,
    updatedAt: organization.updated_at,
  };
}