/**
 * OAuth Callback Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';

const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'syssamba.com';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createRouteHandlerClient(request);
    await supabase.auth.exchangeCodeForSession(code);
    
    // Get user from session to determine redirect
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (authUser) {
      // Get user from database
      const dbUser = await db.selectOne<{
        id: string;
        organization_id: string | null;
      }>('users', {
        eq: { sb_user_id: authUser.id },
      }) || await db.selectOne<{
        id: string;
        organization_id: string | null;
      }>('users', {
        eq: { id: authUser.id },
      });

      if (dbUser) {
        // Check if user is super admin
        const userIsSuperAdmin = await isSuperAdmin(dbUser.id);
        
        // Check if user is System Administrator (admin)
        const dbUserWithProfile = await db.selectOne<{
          profile_id: string | null;
        }>('users', {
          eq: { id: dbUser.id },
        });
        
        let isSystemAdmin = false;
        if (dbUserWithProfile?.profile_id) {
          const profile = await db.selectOne<{
            name: string;
          }>('profiles', {
            eq: { id: dbUserWithProfile.profile_id },
          });
          isSystemAdmin = profile?.name === 'System Administrator';
        }
        
        // Determine redirect URL
        let redirectPath = '/dashboard'; // Default
        
        if (userIsSuperAdmin) {
          redirectPath = '/admin';
        } else if (isSystemAdmin && dbUser.organization_id) {
          // System Admin: check if organization is configured
          const organization = await db.selectOne<{
            is_configured: boolean;
          }>('organizations', {
            eq: { id: dbUser.organization_id },
          });
          
          // Redirect to setup only if admin AND org not configured
          if (!organization?.is_configured) {
            redirectPath = '/setup';
          }
          // else: org is configured, use default /dashboard
        } else if (isSystemAdmin && !dbUser.organization_id) {
          // System Admin without organization - redirect to setup
          redirectPath = '/setup';
        }
        // else: regular user or admin with configured org, use default /dashboard
        
        // Check if user's organization has a subdomain and redirect to it
        if (dbUser.organization_id) {
          const userOrg = await db.selectOne<{
            subdomain: string | null;
          }>('organizations', {
            eq: { id: dbUser.organization_id },
          });
          
          if (userOrg?.subdomain) {
            // Redirect to user's subdomain
            const subdomainUrl = new URL(redirectPath, `https://${userOrg.subdomain}.${MAIN_DOMAIN}`);
            subdomainUrl.search = requestUrl.search;
            console.log(`[Auth Callback] Redirecting user ${authUser.id} to their subdomain: ${userOrg.subdomain}`);
            return NextResponse.redirect(subdomainUrl);
          }
        }
        
        // No subdomain, redirect to main domain
        const redirectUrl = new URL(redirectPath, request.url);
        redirectUrl.search = requestUrl.search;
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // Fallback to dashboard if we can't determine user status
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
