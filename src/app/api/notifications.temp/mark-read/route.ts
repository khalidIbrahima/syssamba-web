import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { z } from 'zod';

const markReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
});

/**
 * POST /api/notifications/mark-read
 * Mark notifications as read
 * Body: { notificationIds?: string[] }
 * - If notificationIds is provided, mark those specific notifications as read
 * - If not provided, mark all unread notifications for the current user as read
 */
export async function POST(req: Request) {
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

    const body = await req.json();
    const validatedData = markReadSchema.parse(body);

    let query = supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('organization_id', user.organizationId)
      .eq('user_id', user.id)
      .is('read_at', null); // Only update unread notifications

    // If specific notification IDs are provided, mark only those
    if (validatedData.notificationIds && validatedData.notificationIds.length > 0) {
      query = query.in('id', validatedData.notificationIds);
    }

    const { error } = await query;

    if (error) {
      console.error('Error marking notifications as read:', error);
      return NextResponse.json(
        { error: 'Failed to mark notifications as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

