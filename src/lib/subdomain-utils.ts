/**
 * Subdomain utility functions
 * Handles subdomain extraction, validation, and organization lookup
 */

import { db } from '@/lib/db';

// Reserved subdomains that cannot be used by organizations
export const RESERVED_SUBDOMAINS = [
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'ftp',
  'localhost',
  'staging',
  'dev',
  'test',
  'demo',
  'www2',
  'ns1',
  'ns2',
  'mail1',
  'mail2',
  'smtp',
  'pop',
  'imap',
  'webmail',
  'cpanel',
  'whm',
  'blog',
  'shop',
  'store',
  'support',
  'help',
  'docs',
  'status',
  'cdn',
  'static',
  'assets',
  'media',
  'images',
  'files',
  'download',
  'upload',
];

/**
 * Extract subdomain from hostname
 * @param hostname - The hostname to extract subdomain from
 * @returns The subdomain or null if not found
 */
export function extractSubdomain(hostname: string): string | null {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'kspace-group.com';
  
  // Remove protocol if present
  const cleanHostname = hostname.replace(/^https?:\/\//, '');
  
  // Remove port if present
  const hostWithoutPort = cleanHostname.split(':')[0];
  
  // Check if it's a subdomain
  if (hostWithoutPort.endsWith(`.${rootDomain}`)) {
    const subdomain = hostWithoutPort.replace(`.${rootDomain}`, '').toLowerCase();
    // Don't treat 'www' or reserved subdomains as organization subdomains
    if (subdomain && subdomain !== 'www' && !RESERVED_SUBDOMAINS.includes(subdomain)) {
      return subdomain;
    }
  }
  
  return null;
}

/**
 * Validate subdomain format
 * @param subdomain - The subdomain to validate
 * @returns True if valid, false otherwise
 */
export function isValidSubdomain(subdomain: string): boolean {
  // Must be 3-63 characters
  if (subdomain.length < 3 || subdomain.length > 63) {
    return false;
  }

  // Must start and end with alphanumeric character
  if (!/^[a-z0-9]/.test(subdomain) || !/[a-z0-9]$/.test(subdomain)) {
    return false;
  }

  // Can only contain lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
    return false;
  }

  // Cannot be a reserved subdomain
  if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
    return false;
  }

  return true;
}

/**
 * Generate a valid subdomain from organization name
 * @param organizationName - The organization name
 * @returns A valid subdomain slug
 */
export function generateSubdomain(organizationName: string): string {
  // Convert to lowercase and replace spaces/special chars with hyphens
  let subdomain = organizationName
    .toLowerCase()
    .normalize('NFD') // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  // Ensure minimum length
  if (subdomain.length < 3) {
    subdomain = subdomain + '-org';
  }

  // Truncate to 63 characters (max subdomain length)
  if (subdomain.length > 63) {
    subdomain = subdomain.substring(0, 63);
    // Remove trailing hyphen if present
    subdomain = subdomain.replace(/-$/, '');
  }

  return subdomain;
}

/**
 * Find available subdomain (with counter if needed)
 * @param baseSubdomain - The base subdomain to check
 * @returns An available subdomain
 */
export async function findAvailableSubdomain(baseSubdomain: string): Promise<string> {
  let subdomain = baseSubdomain;
  let counter = 1;

  while (true) {
    // Check if subdomain is available
    const existing = await db.selectOne<{ id: string }>('organizations', {
      eq: { subdomain },
    });

    if (!existing) {
      return subdomain;
    }

    // Try with counter
    subdomain = `${baseSubdomain}-${counter}`;
    counter++;

    // Safety check to prevent infinite loop
    if (counter > 1000) {
      throw new Error('Unable to find available subdomain after 1000 attempts');
    }
  }
}

/**
 * Get organization by subdomain
 * @param subdomain - The subdomain to look up
 * @returns Organization or null if not found
 */
export async function getOrganizationBySubdomain(subdomain: string) {
  if (!isValidSubdomain(subdomain)) {
    return null;
  }

  try {
    const organization = await db.selectOne<{
      id: string;
      name: string;
      slug: string;
      subdomain: string;
    }>('organizations', {
      eq: { subdomain },
    });

    return organization;
  } catch (error) {
    console.error('[Subdomain Utils] Error looking up organization:', error);
    return null;
  }
}

/**
 * Get full subdomain URL
 * @param subdomain - The subdomain
 * @param path - Optional path to append
 * @returns Full URL with subdomain
 */
export function getSubdomainUrl(subdomain: string, path: string = ''): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'kspace-group.com';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}://${subdomain}.${rootDomain}${cleanPath}`;
}

