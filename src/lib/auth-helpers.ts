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
    subdomain: string | null;
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
    subdomain: organization.subdomain,
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

/**
 * Validate that the user can access the organization from the subdomain
 * This ensures users can only access their own organization's domain
 * 
 * @param request - The incoming request (for extracting headers/subdomain)
 * @returns Object with isValid flag and error message if invalid
 */
export async function validateDomainAccess(request?: Request): Promise<{
  isValid: boolean;
  error?: string;
  organizationId?: string;
}> {
  const user = await getAuthUser();
  
  if (!user || !user.organizationId) {
    return {
      isValid: false,
      error: 'User not authenticated or has no organization',
    };
  }

  // If no request provided, skip subdomain validation (for API routes without subdomain context)
  if (!request) {
    return {
      isValid: true,
      organizationId: user.organizationId,
    };
  }

  // Extract subdomain from request headers (set by middleware)
  const subdomain = request.headers.get('x-subdomain');
  const organizationIdFromHeader = request.headers.get('x-organization-id');

  // If no subdomain in headers, allow access (main domain or no subdomain routing)
  if (!subdomain && !organizationIdFromHeader) {
    return {
      isValid: true,
      organizationId: user.organizationId,
    };
  }

  // Get user's organization with subdomain
  const organization = await db.selectOne<{
    id: string;
    subdomain: string | null;
    slug: string;
  }>('organizations', {
    eq: { id: user.organizationId },
  });

  if (!organization) {
    return {
      isValid: false,
      error: 'Organization not found',
    };
  }

  // Validate subdomain matches user's organization
  if (subdomain && organization.subdomain !== subdomain) {
    return {
      isValid: false,
      error: 'Access denied: You do not have permission to access this domain',
    };
  }

  // Validate organization ID from header matches user's organization
  if (organizationIdFromHeader && organizationIdFromHeader !== user.organizationId) {
    return {
      isValid: false,
      error: 'Access denied: You do not have permission to access this organization',
    };
  }

  return {
    isValid: true,
    organizationId: user.organizationId,
  };
}

/**
 * Require domain access - throws error if user cannot access the domain
 * Use this in API routes to ensure users can only access their own organization's domain
 */
export async function requireDomainAccess(request?: Request): Promise<string> {
  const validation = await validateDomainAccess(request);
  
  if (!validation.isValid) {
    throw new Error(validation.error || 'Access denied');
  }

  return validation.organizationId!;
}
