import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db, supabaseAdmin } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { z } from 'zod';

/**
 * GET /api/messages
 * Get messages for the current user based on their role
 * Query params: tenantId (optional) - filter messages for a specific tenant
 */
export async function GET(req: Request) {
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

    // Get query params
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const recipientUserId = searchParams.get('recipientUserId');
    const senderUserId = searchParams.get('senderUserId');

    // Get user profile permissions
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    let canViewAllMessages = false;
    let canViewOwnMessages = false;

    if (userRecord?.profile_id) {
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const messagePermission = objectPermissions.find(p => p.objectType === 'Message');
      if (messagePermission) {
        canViewAllMessages = messagePermission.canRead && messagePermission.canViewAll;
        canViewOwnMessages = messagePermission.canRead;
      }
    }

    // Build query based on profile permissions
    let query = supabaseAdmin
      .from('messages')
      .select('*')
      .eq('organization_id', user.organizationId);

    // Filter by tenantId if provided
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    // Filter for user-to-user messages
    if (recipientUserId && senderUserId) {
      // Get messages between two users (bidirectional)
      // Messages where current user is sender OR recipientUserId is sender
      // Since we don't have recipient_user_id column yet, we get all messages where:
      // - sender is current user and tenant_id is null (user-to-user message)
      // - sender is the recipientUserId and tenant_id is null
      // We'll filter in application code to ensure they're part of the conversation
      query = query.or(`and(sender_id.eq.${user.id},tenant_id.is.null),and(sender_id.eq.${recipientUserId},tenant_id.is.null)`);
    } else if (recipientUserId) {
      // Messages where current user sent to recipientUserId (tenant_id is null for user-to-user)
      // OR messages where recipientUserId sent to current user
      // Since we don't have recipient_user_id, we get messages from both users
      query = query.or(`and(sender_id.eq.${user.id},tenant_id.is.null),and(sender_id.eq.${recipientUserId},tenant_id.is.null)`);
    } else if (senderUserId) {
      // Messages where senderUserId sent (tenant_id is null for user-to-user)
      // OR messages where current user sent to senderUserId
      query = query.or(`and(sender_id.eq.${senderUserId},tenant_id.is.null),and(sender_id.eq.${user.id},tenant_id.is.null)`);
    }

    // If user can only view own messages, filter by senderId (staff messages)
    if (!canViewAllMessages && canViewOwnMessages && !recipientUserId && !senderUserId) {
      query = query.eq('sender_id', user.id);
    }

    query = query.order('created_at', { ascending: true });

    const { data: messagesList, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    let messagesData = (messagesList || []) as Array<{
      id: string;
      organization_id: string;
      sender_id: string | null;
      sender_type: string;
      tenant_id: string | null;
      recipient_user_id?: string | null;
      content: string | null;
      attachments: string[] | null;
      read_at: Date | string | null;
      created_at: Date | string;
    }>;

    // Filter messages for user-to-user conversations
    // Since recipient_user_id column doesn't exist yet, we filter by sender_id
    if (recipientUserId && senderUserId) {
      // Show messages where sender is one of the two users (bidirectional conversation)
      // senderUserId is the current user, recipientUserId is the other user
      const beforeFilter = messagesData.length;
      messagesData = messagesData.filter(
        (msg) => 
          (msg.sender_id === user.id || msg.sender_id === recipientUserId) &&
          msg.tenant_id === null
      );
      console.log('[Messages API] Filtered messages:', { beforeFilter, afterFilter: messagesData.length, userMessages: messagesData.filter(m => m.sender_id === user.id).length, otherUserMessages: messagesData.filter(m => m.sender_id === recipientUserId).length });
    } else if (recipientUserId) {
      // Show messages in both directions: from current user to recipient OR from recipient to current user
      messagesData = messagesData.filter(
        (msg) => 
          (msg.sender_id === user.id || msg.sender_id === recipientUserId) &&
          msg.tenant_id === null
      );
    } else if (senderUserId) {
      // Show messages in both directions: from senderUserId to current user OR from current user to senderUserId
      messagesData = messagesData.filter(
        (msg) => 
          (msg.sender_id === senderUserId || msg.sender_id === user.id) &&
          msg.tenant_id === null
      );
    }

    // Get sender and recipient details
    const messagesWithDetails = await Promise.all(
      messagesData.map(async (message) => {
        let senderName = null;
        let senderAvatar = null;
        let tenantName = null;

        // If sender is staff (user), get user details
        if (message.sender_type === 'staff' && message.sender_id) {
          const sender = await db.selectOne<{
            id: string;
            first_name: string | null;
            last_name: string | null;
            avatar_url: string | null;
          }>('users', {
            eq: { id: message.sender_id },
          });

          if (sender) {
            senderName = `${sender.first_name || ''} ${sender.last_name || ''}`.trim();
            senderAvatar = sender.avatar_url;
          }
        }

        if (message.tenant_id) {
          const tenant = await db.selectOne<{
            id: string;
            first_name: string;
            last_name: string;
          }>('tenants', {
            eq: { id: message.tenant_id },
          });

          if (tenant) {
            tenantName = `${tenant.first_name} ${tenant.last_name}`;
          }
        }

        return {
          id: message.id,
          senderId: message.sender_id,
          senderType: message.sender_type,
          senderName,
          senderAvatar,
          tenantId: message.tenant_id,
          tenantName,
          content: message.content,
          attachments: message.attachments || [],
          readAt: message.read_at,
          createdAt: message.created_at,
        };
      })
    );

    return NextResponse.json(messagesWithDetails);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const createMessageSchema = z.object({
  tenantId: z.string().uuid().optional(),
  recipientUserId: z.string().uuid().optional(),
  content: z.string().optional(),
  attachments: z.array(z.string()).optional(),
}).refine(
  (data) => data.tenantId || data.recipientUserId,
  {
    message: 'Either tenantId or recipientUserId must be provided',
    path: ['tenantId'],
  }
).refine(
  (data) => (data.content && data.content.trim().length > 0) || (data.attachments && data.attachments.length > 0),
  {
    message: 'Le message doit contenir du texte ou au moins une pièce jointe',
    path: ['content'],
  }
);

/**
 * POST /api/messages
 * Send a message to a tenant
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

    // Check if user can send messages (canCreate on Message object)
    const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
    const messagePermission = objectPermissions.find(p => p.objectType === 'Message');
    const canSendMessages = messagePermission?.canCreate || false;

    if (!canSendMessages) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to send messages. Please contact your administrator to update your profile permissions.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createMessageSchema.parse(body);

    let tenantId: string | null = null;
    let recipientUserId: string | null = null;

    // Handle tenant message
    if (validatedData.tenantId) {
      const tenant = await db.selectOne<{
        id: string;
        organization_id: string;
      }>('tenants', {
        eq: { id: validatedData.tenantId },
      });

      if (!tenant) {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }

      if (tenant.organization_id !== user.organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Tenant does not belong to your organization' },
          { status: 403 }
        );
      }

      tenantId = validatedData.tenantId;
    }

    // Handle user-to-user message
    if (validatedData.recipientUserId) {
      const recipient = await db.selectOne<{
        id: string;
        organization_id: string;
      }>('users', {
        eq: { id: validatedData.recipientUserId },
      });

      if (!recipient) {
        return NextResponse.json(
          { error: 'Recipient user not found' },
          { status: 404 }
        );
      }

      if (recipient.organization_id !== user.organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Recipient does not belong to your organization' },
          { status: 403 }
        );
      }

      recipientUserId = validatedData.recipientUserId;
    }

    // Create message
    const newMessage = await db.insertOne<{
      id: string;
      organization_id: string;
      tenant_id: string | null;
      recipient_user_id: string | null;
      sender_id: string;
      sender_type: string;
      content: string;
      attachments: string[] | null;
      created_at: Date | string;
    }>('messages', {
      organization_id: user.organizationId,
      tenant_id: tenantId,
      recipient_user_id: recipientUserId || null,
      sender_id: user.id,
      sender_type: 'staff',
      content: validatedData.content,
      attachments: validatedData.attachments || null,
    });

    if (!newMessage) {
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: newMessage.id,
      organizationId: newMessage.organization_id,
      tenantId: newMessage.tenant_id,
      recipientUserId: recipientUserId || undefined,
      senderId: newMessage.sender_id,
      senderType: newMessage.sender_type,
      content: newMessage.content,
      attachments: newMessage.attachments || [],
      createdAt: newMessage.created_at,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

