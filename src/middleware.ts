/**
 * Next.js Middleware
 * Handles internationalization, route protection and authentication
 */

import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

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
  const pathname = new URL(req.url).pathname;

  // Run intl middleware first to handle locale routing
  const response = intlMiddleware(req);
  
  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(fr|en)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : 'fr';
  const pathnameWithoutLocale = localeMatch 
    ? pathname.replace(`/${locale}`, '') || '/' 
    : pathname;

  // If intl middleware redirected (e.g., to add locale), return it
  if (response.status === 307 || response.status === 308) {
    return response;
  }

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
        signInUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(signInUrl);
      }
    } catch (error) {
      console.log(`[Middleware] Auth error for ${pathnameWithoutLocale}:`, error);
      const signInUrl = new URL(`/${locale}/auth/sign-in`, req.url);
      signInUrl.searchParams.set('redirect', pathname);
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
