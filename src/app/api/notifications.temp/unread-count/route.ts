import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/notifications/unread-count
 * Get the count of unread notifications for the current user
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

    // Count unread notifications for the current user
    // Check if user_id column exists, if not, return 0 (migration not run yet)
    try {
      const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', user.organizationId)
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) {
        // If column doesn't exist, return 0
        if (error.message?.includes('column') && error.message?.includes('does not exist')) {
          console.warn('Notifications table not migrated yet, returning 0');
          return NextResponse.json({ unreadCount: 0 });
        }
        console.error('Error counting unread notifications:', error);
        return NextResponse.json(
          { error: 'Internal server error', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ unreadCount: count || 0 });
    } catch (error: any) {
      // Handle case where column doesn't exist
      if (error?.message?.includes('column') || error?.code === '42703') {
        console.warn('Notifications table not migrated yet, returning 0');
        return NextResponse.json({ unreadCount: 0 });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

