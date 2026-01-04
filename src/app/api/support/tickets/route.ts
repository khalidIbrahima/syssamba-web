/**
 * Support Tickets API
 * Allows organization admins to create tickets
 * Super admins can view and manage all tickets
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'critical']).optional().default('medium'),
  category: z.enum(['technical', 'billing', 'feature_request', 'bug_report', 'account', 'other']).optional(),
  type: z.enum(['question', 'issue', 'request', 'complaint', 'other']).optional(),
  tags: z.array(z.string()).optional().default([]),
  attachments: z.array(z.string()).optional().default([]),
  metadata: z.record(z.any()).optional().default({}),
});

const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'critical']).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

/**
 * POST /api/support/tickets
 * Create a new support ticket (organization admins only)
 */
export async function POST(request: NextRequest) {
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

    // Check if user is organization admin (can edit Organization)
    // For now, we'll allow any authenticated user with an organization
    if (!user.organizationId) {
      return NextResponse.json(
        { error: 'You must be part of an organization to create support tickets' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createTicketSchema.parse(body);

    // Create ticket
    const ticket = await db.insertOne('support_tickets', {
      subject: validatedData.subject,
      description: validatedData.description,
      priority: validatedData.priority,
      category: validatedData.category || null,
      type: validatedData.type || null,
      created_by: user.id,
      organization_id: user.organizationId,
      tags: validatedData.tags,
      attachments: validatedData.attachments,
      metadata: validatedData.metadata,
      status: 'open',
    });

    await logger.info('Support ticket created', {
      userId: user.id,
      organizationId: user.organizationId,
      requestPath: '/api/support/tickets',
      requestMethod: 'POST',
      tags: ['support', 'ticket'],
      context: {
        ticketId: ticket?.id,
        ticketNumber: ticket?.ticket_number,
        priority: validatedData.priority,
      },
    });

    return NextResponse.json({
      success: true,
      ticket,
    }, { status: 201 });

  } catch (error) {
    await logger.error('Error creating support ticket', error as Error, {
      requestPath: '/api/support/tickets',
      requestMethod: 'POST',
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

/**
 * GET /api/support/tickets
 * Get support tickets
 * - Organization admins: see tickets from their organization
 * - Super admins: see all tickets with filters
 */
export async function GET(request: NextRequest) {
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

    const userIsSuperAdmin = await isSuperAdmin(user.id);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const category = searchParams.get('category') || undefined;
    const organizationId = searchParams.get('organizationId') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Build query options
    const queryOptions: any = {
      orderBy: { column: 'created_at', ascending: false },
      limit,
      offset,
    };

    // Apply filters
    if (status) {
      queryOptions.eq = { ...queryOptions.eq, status };
    }
    if (priority) {
      queryOptions.eq = { ...queryOptions.eq, priority };
    }
    if (category) {
      queryOptions.eq = { ...queryOptions.eq, category };
    }
    if (assignedTo) {
      queryOptions.eq = { ...queryOptions.eq, assigned_to: assignedTo };
    }

    // Organization admins can only see their organization's tickets
    if (!userIsSuperAdmin) {
      if (!user.organizationId) {
        return NextResponse.json(
          { error: 'You must be part of an organization to view support tickets' },
          { status: 403 }
        );
      }
      queryOptions.eq = { ...queryOptions.eq, organization_id: user.organizationId };
    } else if (organizationId) {
      // Super admins can filter by organization
      queryOptions.eq = { ...queryOptions.eq, organization_id: organizationId };
    }

    // Fetch tickets
    const tickets = await db.select('support_tickets', queryOptions);

    // Get total count
    const totalCount = tickets.length;

    await logger.info('Support tickets retrieved', {
      userId: user.id,
      requestPath: '/api/support/tickets',
      requestMethod: 'GET',
      tags: ['support', 'ticket'],
      context: {
        isSuperAdmin: userIsSuperAdmin,
        count: tickets.length,
        filters: { status, priority, category, organizationId },
      },
    });

    return NextResponse.json({
      tickets,
      count: tickets.length,
      total: totalCount,
      limit,
      offset,
    });

  } catch (error) {
    await logger.error('Error fetching support tickets', error as Error, {
      requestPath: '/api/support/tickets',
      requestMethod: 'GET',
      tags: ['support', 'error'],
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

