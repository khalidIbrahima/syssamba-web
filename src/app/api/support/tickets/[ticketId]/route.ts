/**
 * Support Ticket Detail API
 * Get, update, or delete a specific ticket
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'critical']).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

/**
 * GET /api/support/tickets/[ticketId]
 * Get a specific ticket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { ticketId } = await params;
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    // Fetch ticket
    const ticket = await db.selectOne('support_tickets', {
      eq: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Check access: organization admins can only see their organization's tickets
    if (!userIsSuperAdmin && ticket.organization_id !== user.organizationId) {
      await logger.warn('Unauthorized access attempt to ticket', {
        userId: user.id,
        ticketId,
        requestPath: `/api/support/tickets/${ticketId}`,
        requestMethod: 'GET',
        tags: ['support', 'security'],
      });

      return NextResponse.json(
        { error: 'Forbidden: You can only access tickets from your organization' },
        { status: 403 }
      );
    }

    // Fetch comments
    const comments = await db.select('support_ticket_comments', {
      eq: { ticket_id: ticketId },
      orderBy: { column: 'created_at', ascending: true },
    });

    return NextResponse.json({
      ticket,
      comments,
    });

  } catch (error) {
    await logger.error('Error fetching ticket', error as Error, {
      requestPath: `/api/support/tickets/[ticketId]`,
      requestMethod: 'GET',
      tags: ['support', 'error'],
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/support/tickets/[ticketId]
 * Update a ticket (super admins only, or ticket creator)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { ticketId } = await params;
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    // Fetch ticket
    const ticket = await db.selectOne('support_tickets', {
      eq: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Check access: only super admins or ticket creator can update
    if (!userIsSuperAdmin && ticket.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only update your own tickets' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateTicketSchema.parse(body);

    // Build update data
    const updateData: any = {};
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
      if (validatedData.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = user.id;
      }
    }
    if (validatedData.priority !== undefined) {
      updateData.priority = validatedData.priority;
    }
    if (validatedData.assignedTo !== undefined) {
      updateData.assigned_to = validatedData.assignedTo;
      if (validatedData.assignedTo) {
        updateData.assigned_at = new Date().toISOString();
      } else {
        updateData.assigned_at = null;
      }
    }
    if (validatedData.resolutionNotes !== undefined) {
      updateData.resolution_notes = validatedData.resolutionNotes;
    }
    if (validatedData.tags !== undefined) {
      updateData.tags = validatedData.tags;
    }

    // Update ticket
    const updatedTicket = await db.updateOne(
      'support_tickets',
      updateData,
      { id: ticketId }
    );

    await logger.info('Support ticket updated', {
      userId: user.id,
      ticketId,
      requestPath: `/api/support/tickets/${ticketId}`,
      requestMethod: 'PATCH',
      tags: ['support', 'ticket'],
      context: {
        updates: validatedData,
      },
    });

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
    });

  } catch (error) {
    await logger.error('Error updating ticket', error as Error, {
      requestPath: `/api/support/tickets/[ticketId]`,
      requestMethod: 'PATCH',
      tags: ['support', 'error'],
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

