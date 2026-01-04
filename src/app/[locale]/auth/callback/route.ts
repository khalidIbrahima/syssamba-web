/**
 * OAuth Callback Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';

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
        
        // Determine redirect URL
        let redirectUrl = '/dashboard'; // Default
        
        if (userIsSuperAdmin) {
          redirectUrl = '/admin';
        } else if (!dbUser.organization_id) {
          redirectUrl = '/setup';
        }
        // else: has organization, use default /dashboard
        
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }
  }

  // Fallback to dashboard if we can't determine user status
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
