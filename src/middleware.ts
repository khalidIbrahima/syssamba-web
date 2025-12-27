/**
 * Next.js Middleware
 * Handles route protection and authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';

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

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    return response;
  }

  // Check protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    try {
      const supabase = createMiddlewareClient(req);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log(`[Middleware] Redirecting unauthenticated user from ${pathname} to sign-in`);
        const signInUrl = new URL('/auth/sign-in', req.url);
        signInUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(signInUrl);
      }
      // console.log(`[Middleware] Authenticated user accessing ${pathname}`);
    } catch (error) {
      console.log(`[Middleware] Auth error for ${pathname}:`, error);
      const signInUrl = new URL('/auth/sign-in', req.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
