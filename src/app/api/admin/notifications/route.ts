import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';

/**
 * GET /api/admin/notifications
 * Get all notifications for super admin
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
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    // Get all notifications for this super admin
    const notifications = await db.select<{
      id: string;
      organization_id: string | null;
      type: string;
      content: string | null;
      created_at: string;
      read_at: string | null;
    }>('notifications', {
      eq: { user_id: userId },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

