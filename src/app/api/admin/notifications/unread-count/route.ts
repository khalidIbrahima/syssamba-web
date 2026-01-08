import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';

/**
 * GET /api/admin/notifications/unread-count
 * Get unread notification count for super admin
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

    // Check if user is super admin
    const userIsSuperAdmin = await isSuperAdmin(userId);
    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { unreadCount: 0 }
      );
    }

    // Count unread notifications for this super admin
    const notifications = await db.select<{
      id: string;
      read_at: string | null;
    }>('notifications', {
      eq: { user_id: userId },
    });

    const unreadCount = notifications.filter(n => !n.read_at).length;

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching admin notification unread count:', error);
    return NextResponse.json(
      { unreadCount: 0 }
    );
  }
}

