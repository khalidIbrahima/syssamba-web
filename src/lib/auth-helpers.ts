/**
 * Authentication Helpers
 * Server-side authentication utilities for API routes
 * Maintains backward compatibility with existing API routes
 */

import { getCurrentUser as getAuthUser } from './auth';
import { db } from './db';

/**
 * Check if user is authenticated
 * Returns userId if authenticated, null otherwise
 */
export async function checkAuth(): Promise<{ userId: string | null }> {
  const user = await getAuthUser();
  return { userId: user?.id || null };
}

/**
 * Get current authenticated user
 * Re-export from auth.ts to maintain backward compatibility
 */
export async function getCurrentUser() {
  return await getAuthUser();
}

/**
 * Get current user's organization
 */
export async function getCurrentOrganization() {
  const user = await getAuthUser();
  
  if (!user || !user.organizationId) {
    return null;
  }

  const organization = await db.selectOne<{
    id: string;
    name: string;
    slug: string;
    type: string;
    country: string | null;
    is_configured: boolean;
    custom_extranet_domain: string | null;
    extranet_tenants_count: number | null;
    stripe_customer_id: string | null;
    created_at: Date | string;
    updated_at: Date | string;
  }>('organizations', {
    eq: { id: user.organizationId },
  });

  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    type: organization.type,
    country: organization.country,
    isConfigured: organization.is_configured,
    customExtranetDomain: organization.custom_extranet_domain,
    extranetTenantsCount: organization.extranet_tenants_count,
    stripeCustomerId: organization.stripe_customer_id,
    createdAt: organization.created_at,
    updatedAt: organization.updated_at,
  };
}
