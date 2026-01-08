import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';

/**
 * POST /api/admin/notifications/mark-read
 * Mark all notifications as read for super admin
 */
export async function POST(request: Request) {
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
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const notificationId = body.notificationId;

    // If specific notification ID provided, mark only that one as read
    if (notificationId) {
      await db.update('notifications', {
        read_at: new Date().toISOString(),
      }, {
        eq: { id: notificationId, user_id: userId },
      });
    } else {
      // Mark all unread notifications as read
      const unreadNotifications = await db.select<{
        id: string;
        read_at: string | null;
      }>('notifications', {
        eq: { user_id: userId },
      });

      const unreadIds = unreadNotifications
        .filter(n => !n.read_at)
        .map(n => n.id);

      if (unreadIds.length > 0) {
        // Update each notification
        for (const id of unreadIds) {
          await db.update('notifications', {
            read_at: new Date().toISOString(),
          }, {
            eq: { id, user_id: userId },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking admin notifications as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

