import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/messages/unread-count
 * Get the count of unread messages for the current user
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

    // Count unread messages for the current user
    // Unread messages are:
    // 1. User-to-user messages where recipient_user_id = current user AND read_at IS NULL
    // 2. Tenant messages (tenant_id IS NOT NULL) where sender_type = 'tenant' AND read_at IS NULL
    //    (these are messages from tenants to staff)
    
    // Count user-to-user messages
    const userToUserCount = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', user.organizationId)
      .eq('recipient_user_id', user.id)
      .is('tenant_id', null)
      .is('read_at', null);

    // Count tenant messages (messages from tenants to staff)
    const tenantMessagesCount = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', user.organizationId)
      .not('tenant_id', 'is', null)
      .eq('sender_type', 'tenant')
      .is('read_at', null);

    const unreadCount = (userToUserCount.count || 0) + (tenantMessagesCount.count || 0);

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

