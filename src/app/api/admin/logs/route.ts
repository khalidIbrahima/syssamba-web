/**
 * API Route for viewing system logs
 * Only accessible to super-admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const getLogsSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'critical']).optional(),
  status: z.enum(['open', 'investigating', 'resolved', 'ignored']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit: z.number().min(1).max(1000).optional().default(100),
  offset: z.number().min(0).optional().default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  tag: z.string().optional(),
});

/**
 * GET /api/admin/logs
 * Get system logs (super-admin only)
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      await logger.warn('Unauthorized access attempt to logs API', {
        userId: user.id,
        requestPath: '/api/admin/logs',
        requestMethod: 'GET',
        tags: ['security', 'unauthorized'],
      });

      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      level: searchParams.get('level') || undefined,
      status: searchParams.get('status') || undefined,
      severity: searchParams.get('severity') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      userId: searchParams.get('userId') || undefined,
      organizationId: searchParams.get('organizationId') || undefined,
      tag: searchParams.get('tag') || undefined,
    };

    const validatedParams = getLogsSchema.parse(queryParams);

    // Build query options
    const queryOptions: any = {
      orderBy: { column: 'created_at', ascending: false },
      limit: validatedParams.limit,
      offset: validatedParams.offset,
    };

    // Apply filters
    if (validatedParams.level) {
      queryOptions.eq = { ...queryOptions.eq, level: validatedParams.level };
    }
    if (validatedParams.status) {
      queryOptions.eq = { ...queryOptions.eq, status: validatedParams.status };
    }
    if (validatedParams.severity) {
      queryOptions.eq = { ...queryOptions.eq, severity: validatedParams.severity };
    }
    if (validatedParams.userId) {
      queryOptions.eq = { ...queryOptions.eq, user_id: validatedParams.userId };
    }
    if (validatedParams.organizationId) {
      queryOptions.eq = { ...queryOptions.eq, organization_id: validatedParams.organizationId };
    }

    // Fetch logs
    const logs = await db.select('system_logs', queryOptions);

    // Filter by tag if provided (PostgreSQL array contains)
    let filteredLogs = logs;
    if (validatedParams.tag) {
      filteredLogs = logs.filter((log: any) => 
        log.tags && Array.isArray(log.tags) && log.tags.includes(validatedParams.tag)
      );
    }

    // Filter by date range if provided
    if (validatedParams.startDate || validatedParams.endDate) {
      filteredLogs = filteredLogs.filter((log: any) => {
        const logDate = new Date(log.created_at);
        if (validatedParams.startDate && logDate < new Date(validatedParams.startDate)) {
          return false;
        }
        if (validatedParams.endDate && logDate > new Date(validatedParams.endDate)) {
          return false;
        }
        return true;
      });
    }

    // Get total count
    const totalCount = filteredLogs.length;

    await logger.info('System logs retrieved', {
      userId: user.id,
      requestPath: '/api/admin/logs',
      requestMethod: 'GET',
      tags: ['api', 'logs'],
      context: {
        filters: validatedParams,
        count: filteredLogs.length,
      },
    });

    return NextResponse.json({
      logs: filteredLogs,
      count: filteredLogs.length,
      total: totalCount,
      limit: validatedParams.limit,
      offset: validatedParams.offset,
    });

  } catch (error) {
    await logger.error('Error fetching system logs', error as Error, {
      requestPath: '/api/admin/logs',
      requestMethod: 'GET',
      tags: ['api', 'error'],
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
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
 * PATCH /api/admin/logs
 * Update log status (e.g., mark as resolved)
 */
export async function PATCH(request: NextRequest) {
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { logId, status } = body;

    if (!logId || !status) {
      return NextResponse.json(
        { error: 'logId and status are required' },
        { status: 400 }
      );
    }

    if (!['open', 'investigating', 'resolved', 'ignored'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Update log
    const updateData: any = {
      status,
    };

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = user.id;
    }

    const updatedLog = await db.updateOne(
      'system_logs',
      updateData,
      { id: logId }
    );

    if (!updatedLog) {
      return NextResponse.json(
        { error: 'Log not found' },
        { status: 404 }
      );
    }

    await logger.info('Log status updated', {
      userId: user.id,
      requestPath: '/api/admin/logs',
      requestMethod: 'PATCH',
      tags: ['api', 'logs'],
      context: {
        logId,
        status,
      },
    });

    return NextResponse.json({
      success: true,
      log: updatedLog,
    });

  } catch (error) {
    await logger.error('Error updating log status', error as Error, {
      requestPath: '/api/admin/logs',
      requestMethod: 'PATCH',
      tags: ['api', 'error'],
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

