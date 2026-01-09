/**
 * Next.js Middleware
 * Handles subdomain routing, internationalization, route protection and authentication
 */

import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { routing } from '@/i18n/routing';
import { db } from '@/lib/db';

const intlMiddleware = createMiddleware(routing);

// Main domain - organizations use subdomains on this domain
const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'syssamba.com';

// Extract subdomain from hostname
function getSubdomain(hostname: string): string | null {
  // Remove protocol if present
  const cleanHostname = hostname.replace(/^https?:\/\//, '');
  
  // Remove port if present
  const hostWithoutPort = cleanHostname.split(':')[0];
  
  // Check if it's a subdomain of main domain
  if (hostWithoutPort.endsWith(`.${MAIN_DOMAIN}`)) {
    const subdomain = hostWithoutPort.replace(`.${MAIN_DOMAIN}`, '');
    if (subdomain && subdomain !== 'www') {
      return subdomain;
    }
  }
  
  return null;
}

const publicRoutes = ['/auth', '/invite', '/', '/pricing'];
const protectedRoutes = [
  '/dashboard',
  '/properties',
  '/units',
  '/tenants',
  '/leases',
  '/payments',
  '/accounting',
  '/tasks',
  '/notifications',
  '/settings',
  '/setup',
  '/admin',
];

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const hostname = req.headers.get('host') || url.hostname;
  const pathname = url.pathname;
  
  // Extract subdomain from hostname
  const subdomain = getSubdomain(hostname);
  
  // Handle subdomain routing
  if (subdomain) {
    try {
      // Look up organization by subdomain
      const organization = await db.selectOne<{ 
        id: string; 
        slug: string;
      }>('organizations', {
        eq: { subdomain },
      });

      if (organization) {
        // Add organization context to request headers
        const response = intlMiddleware(req);
        const finalResponse = response || NextResponse.next();
        finalResponse.headers.set('x-organization-id', organization.id);
        finalResponse.headers.set('x-organization-slug', organization.slug);
        finalResponse.headers.set('x-subdomain', subdomain);
        
        // Continue with normal routing
        return handleNormalRouting(req, finalResponse, pathname);
      } else {
        // Subdomain not found, redirect to main domain
        const mainDomainUrl = new URL(pathname, `https://${MAIN_DOMAIN}`);
        mainDomainUrl.search = url.search;
        return NextResponse.redirect(mainDomainUrl);
      }
    } catch (error) {
      console.error('[Middleware] Error looking up subdomain:', error);
      // On error, continue with normal routing (don't break the app)
    }
  }

  // Main domain or no subdomain - check if user should be redirected to their subdomain
  // Only redirect authenticated users accessing protected routes (NOT auth routes)
  // Extract locale from pathname for route checking
  const localeMatch = pathname.match(/^\/(fr|en)(\/|$)/);
  const pathnameWithoutLocale = localeMatch 
    ? pathname.replace(`/${localeMatch[1]}`, '') || '/' 
    : pathname;
  const isPublicRoute = publicRoutes.some(route => pathnameWithoutLocale === route || pathnameWithoutLocale.startsWith(route + '/'));
  const isAuthRoute = pathnameWithoutLocale.startsWith('/auth');
  const isProtectedRoute = protectedRoutes.some(route => pathnameWithoutLocale.startsWith(route));
  
  // If it's a protected route (and NOT an auth route), check if user should be redirected to their subdomain
  if (isProtectedRoute && !isPublicRoute && !isAuthRoute) {
    try {
      // Skip during build time
      if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        // Continue with normal routing
      } else {
        const supabase = createMiddlewareClient(req);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Get user's organization from database
          const dbUser = await db.selectOne<{
            id: string;
            organization_id: string | null;
          }>('users', {
            eq: { sb_user_id: user.id },
          });
          
          // If user has an organization, check if it has a subdomain
          if (dbUser && dbUser.organization_id) {
            const userOrg = await db.selectOne<{
              subdomain: string | null;
            }>('organizations', {
              eq: { id: dbUser.organization_id },
            });
            
            // Redirect to user's subdomain if it exists
            if (userOrg?.subdomain) {
              // Preserve locale and pathname in redirect
              const userSubdomainUrl = new URL(pathname, `https://${userOrg.subdomain}.${MAIN_DOMAIN}`);
              userSubdomainUrl.search = url.search;
              console.log(`[Middleware] Auto-redirecting user ${user.id} to their subdomain: ${userOrg.subdomain}`);
              return NextResponse.redirect(userSubdomainUrl);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Middleware] Error checking user subdomain redirect:', error);
      // Continue with normal routing on error
    }
  }
  
  // Continue with normal routing
  const response = intlMiddleware(req);
  
  // If intl middleware redirected (e.g., to add locale), return it
  if (response.status === 307 || response.status === 308) {
    return response;
  }
  
  return handleNormalRouting(req, response, pathname);
}

async function handleNormalRouting(
  req: NextRequest,
  response: NextResponse,
  pathname: string
): Promise<NextResponse> {
  const url = new URL(req.url);
  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(fr|en)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : 'fr';
  const pathnameWithoutLocale = localeMatch 
    ? pathname.replace(`/${locale}`, '') || '/' 
    : pathname;

  // Handle authentication for protected routes
  // Allow public routes
  if (publicRoutes.some(route => pathnameWithoutLocale === route || pathnameWithoutLocale.startsWith(route + '/'))) {
    const finalResponse = response || NextResponse.next();
    finalResponse.headers.set('x-pathname', pathnameWithoutLocale);
    return finalResponse;
  }

  // Check protected routes
  if (protectedRoutes.some(route => pathnameWithoutLocale.startsWith(route))) {
    try {
      // Skip authentication during build time
      if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const finalResponse = response || NextResponse.next();
        finalResponse.headers.set('x-pathname', pathnameWithoutLocale);
        return finalResponse;
      }

      const supabase = createMiddlewareClient(req);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log(`[Middleware] Redirecting unauthenticated user from ${pathnameWithoutLocale} to sign-in`);
        const signInUrl = new URL(`/${locale}/auth/sign-in`, req.url);
        
        // Don't set redirect parameter for /setup - setup should only be accessed by System Administrators
        // They will be redirected there by the auth logic after login, not via redirect parameter
        if (pathnameWithoutLocale !== '/setup' && !pathnameWithoutLocale.startsWith('/setup/')) {
          signInUrl.searchParams.set('redirect', pathname);
        }
        // If redirecting from /setup, don't set redirect param - let auth logic handle it
        
        return NextResponse.redirect(signInUrl);
      }

      // Validate domain access: ensure user can only access their organization's subdomain
      const organizationIdFromHeader = req.headers.get('x-organization-id');
      if (organizationIdFromHeader) {
        // Get user's organization from database
        const dbUser = await db.selectOne<{
          id: string;
          organization_id: string | null;
        }>('users', {
          eq: { sb_user_id: user.id },
        });

        // If user exists in database, validate organization access
        if (dbUser && dbUser.organization_id) {
          if (dbUser.organization_id !== organizationIdFromHeader) {
            console.log(`[Middleware] User ${user.id} attempted to access organization ${organizationIdFromHeader} but belongs to ${dbUser.organization_id}`);
            // Redirect to their own organization's subdomain or main domain
            const userOrg = await db.selectOne<{
              subdomain: string | null;
            }>('organizations', {
              eq: { id: dbUser.organization_id },
            });

            if (userOrg?.subdomain) {
              const userSubdomainUrl = new URL(pathnameWithoutLocale, `https://${userOrg.subdomain}.${MAIN_DOMAIN}`);
              userSubdomainUrl.search = url.search;
              return NextResponse.redirect(userSubdomainUrl);
            } else {
              // Redirect to main domain if no subdomain
              const mainDomainUrl = new URL(pathnameWithoutLocale, `https://${MAIN_DOMAIN}`);
              mainDomainUrl.search = url.search;
              return NextResponse.redirect(mainDomainUrl);
            }
          }
        }
      }
    } catch (error) {
      console.log(`[Middleware] Auth error for ${pathnameWithoutLocale}:`, error);
      const signInUrl = new URL(`/${locale}/auth/sign-in`, req.url);
      
      // Don't set redirect parameter for /setup - setup should only be accessed by System Administrators
      if (pathnameWithoutLocale !== '/setup' && !pathnameWithoutLocale.startsWith('/setup/')) {
        signInUrl.searchParams.set('redirect', pathname);
      }
      
      return NextResponse.redirect(signInUrl);
    }
  }

  const finalResponse = response || NextResponse.next();
  finalResponse.headers.set('x-pathname', pathnameWithoutLocale);
  return finalResponse;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
