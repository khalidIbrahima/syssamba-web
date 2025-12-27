import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { z } from 'zod';

const markReadSchema = z.object({
  messageIds: z.array(z.string().uuid()).optional(),
  recipientUserId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
});

/**
 * POST /api/messages/mark-read
 * Mark messages as read
 * Body: { messageIds?: string[], recipientUserId?: string, tenantId?: string }
 * - If messageIds is provided, mark those specific messages as read
 * - If recipientUserId is provided, mark all unread messages from that user as read
 * - If tenantId is provided, mark all unread messages from that tenant as read
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
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('organization_id', user.organizationId)
      .is('read_at', null); // Only update unread messages

    // If specific message IDs are provided, mark only those
    if (validatedData.messageIds && validatedData.messageIds.length > 0) {
      query = query.in('id', validatedData.messageIds);
    } else if (validatedData.recipientUserId) {
      // Mark all unread messages from this user
      query = query
        .eq('recipient_user_id', user.id)
        .eq('sender_id', validatedData.recipientUserId)
        .is('tenant_id', null);
    } else if (validatedData.tenantId) {
      // Mark all unread messages from this tenant
      query = query
        .eq('tenant_id', validatedData.tenantId)
        .eq('sender_type', 'tenant');
    } else {
      // If no specific filter, mark all unread messages for the current user
      query = query.or(`recipient_user_id.eq.${user.id},and(tenant_id.not.is.null,sender_type.eq.tenant)`);
    }

    const { error } = await query;

    if (error) {
      console.error('Error marking messages as read:', error);
      return NextResponse.json(
        { error: 'Failed to mark messages as read' },
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

    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

