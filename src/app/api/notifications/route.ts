import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { notifications, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getProfileObjectPermissions } from '@/lib/profiles';

/**
 * GET /api/notifications
 * Get notifications for the current user based on their role
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

    // Get user profile permissions
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (!userRecord?.profile_id) {
      return NextResponse.json(
        { error: 'User has no profile assigned' },
        { status: 403 }
      );
    }

    // Check if user can read notifications (canRead on Activity or Organization object)
    // Notifications are typically accessible if user can view activities or organization
    const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
    const canViewActivities = objectPermissions.find(p => p.objectType === 'Activity')?.canRead || false;
    const canViewOrganization = objectPermissions.find(p => p.objectType === 'Organization')?.canRead || false;

    if (!canViewActivities && !canViewOrganization) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view notifications' },
        { status: 403 }
      );
    }

    // Build where conditions - notifications are organization-wide
    // Since notifications table doesn't have userId, we filter by organization
    // In a real implementation, you might want to add userId to notifications table
    const conditions = [
      eq(notifications.organizationId, user.organizationId),
    ];

    const notificationsList = await db
      .select({
        id: notifications.id,
        organizationId: notifications.organizationId,
        tenantId: notifications.tenantId,
        type: notifications.type,
        channel: notifications.channel,
        content: notifications.content,
        status: notifications.status,
        sentAt: notifications.sentAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(...conditions))
      .orderBy(notifications.createdAt);

    return NextResponse.json({
      notifications: notificationsList,
      totalCount: notificationsList.length,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

