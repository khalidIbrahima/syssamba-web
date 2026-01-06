import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-db';

/**
 * GET /api/users
 * Get all users in the current user's organization
 */
export async function GET() {
  try {
    const { userId } = await checkAuth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get all users in the organization using direct Supabase query
    try {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, sb_user_id, email, phone, first_name, last_name, avatar_url, role, is_active, organization_id')
        .eq('organization_id', user.organizationId);

      if (usersError) {
        console.error('Error fetching users from Supabase:', usersError);
        // Return empty array instead of throwing to prevent 500 error
        // The UI can handle empty user list gracefully
        return NextResponse.json([]);
      }

      if (!users || users.length === 0) {
        return NextResponse.json([]);
      }

      // Map to camelCase and exclude current user
      const usersList = users
        .filter((u) => u.id !== user.id)
        .map((u) => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          firstName: u.first_name,
          lastName: u.last_name,
          avatarUrl: u.avatar_url,
          role: u.role,
          isActive: u.is_active,
          organizationId: u.organization_id,
        }));

      return NextResponse.json(usersList);
    } catch (error: any) {
      console.error('Error in users API:', error);
      // If it's a connection timeout, return empty array
      if (error?.message?.includes('timeout') || error?.message?.includes('fetch failed')) {
        console.warn('Supabase connection timeout - returning empty user list');
        return NextResponse.json([]);
      }
      throw error;
    }

  } catch (error: any) {
    console.error('Error in users API route:', error);
    
    // Handle connection timeout gracefully
    if (error?.message?.includes('timeout') || error?.message?.includes('fetch failed')) {
      return NextResponse.json(
        { 
          error: 'Connection timeout. Please check your Supabase configuration and network connection.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 503 } // Service Unavailable
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

