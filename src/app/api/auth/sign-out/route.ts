/**
 * Sign Out API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient(request);
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });

    // Clear Supabase cookies
    const cookieStore = await import('next/headers').then(m => m.cookies());
    const allCookies = cookieStore.getAll();
    const supabaseCookies = allCookies.filter(c => c.name.startsWith('sb-'));

    supabaseCookies.forEach(cookie => {
      response.cookies.delete(cookie.name);
    });

    return response;
  } catch (error: any) {
    console.error('Sign out error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
