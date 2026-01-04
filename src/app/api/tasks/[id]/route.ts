import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  assignedTenantId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in_progress', 'waiting', 'done']).optional(),
  attachments: z.array(z.string()).optional(),
});

/**
 * Helper function to safely convert date to ISO string
 */
function safeToISOString(date: Date | string | number | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString();
  
  try {
    const d = new Date(date);
    return d.toISOString();
  } catch (e) {
    console.error('Failed to convert date to ISO string:', date, e);
    return null;
  }
}

/**
 * GET /api/tasks/[id]
 * Get a single task by ID
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
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
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
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

    // Check if user can read tasks
    const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
    const taskPermission = objectPermissions.find(p => p.objectType === 'Task');
    const canReadTasks = taskPermission?.canRead || false;

    if (!canReadTasks) {
      return NextResponse.json(
        { error: 'You do not have permission to view tasks' },
        { status: 403 }
      );
    }

    // Get task
    const task = await db.selectOne<{
      id: string;
      organization_id: string;
      title: string;
      description: string | null;
      created_by: string | null;
      assigned_to: string | null;
      assigned_tenant_id: string | null;
      due_date: Date | null;
      priority: string;
      status: string;
      attachments: string[] | null;
      created_at: Date;
      updated_at: Date | null;
    }>('tasks', {
      eq: { id },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Verify task belongs to user's organization
    if (task.organization_id !== organization.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Verify user can access this task (must be creator OR assigned to)
    if (task.created_by !== userId && task.assigned_to !== userId) {
      // Check if user has canViewAll permission
      if (!taskPermission?.canViewAll) {
        return NextResponse.json(
          { error: 'You do not have permission to view this task' },
          { status: 403 }
        );
      }
    }

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: task.id,
      organizationId: task.organization_id,
      title: task.title,
      description: task.description,
      createdBy: task.created_by,
      assignedTo: task.assigned_to,
      assignedTenantId: task.assigned_tenant_id,
      dueDate: safeToISOString(task.due_date),
      priority: task.priority,
      status: task.status,
      attachments: task.attachments || [],
      createdAt: safeToISOString(task.created_at) || '',
      updatedAt: safeToISOString(task.updated_at),
    });
  } catch (error: any) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tasks/[id]
 * Update a task
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
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
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
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

    // Check if user can edit tasks
    const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
    const taskPermission = objectPermissions.find(p => p.objectType === 'Task');
    const canEditTasks = taskPermission?.canEdit || false;

    if (!canEditTasks) {
      return NextResponse.json(
        { error: 'You do not have permission to edit tasks' },
        { status: 403 }
      );
    }

    // Get existing task
    const existingTask = await db.selectOne<{
      id: string;
      organization_id: string;
      created_by: string | null;
    }>('tasks', {
      eq: { id },
    });

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Verify task belongs to user's organization
    if (existingTask.organization_id !== organization.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = updateTaskSchema.parse(body);

    // Update task
    const updateData: any = {};
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.assignedTo !== undefined) updateData.assigned_to = validatedData.assignedTo;
    if (validatedData.assignedTenantId !== undefined) updateData.assigned_tenant_id = validatedData.assignedTenantId;
    if (validatedData.dueDate !== undefined) {
      updateData.due_date = validatedData.dueDate ? new Date(validatedData.dueDate) : null;
    }
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.attachments !== undefined) updateData.attachments = validatedData.attachments;

    const updatedTask = await db.update('tasks', {
      eq: { id },
    }, updateData);

    if (!updatedTask) {
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }

    // Fetch updated task
    const task = await db.selectOne<{
      id: string;
      organization_id: string;
      title: string;
      description: string | null;
      created_by: string | null;
      assigned_to: string | null;
      assigned_tenant_id: string | null;
      due_date: Date | null;
      priority: string;
      status: string;
      attachments: string[] | null;
      created_at: Date;
      updated_at: Date | null;
    }>('tasks', {
      eq: { id },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found after update' },
        { status: 404 }
      );
    }

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: task.id,
      organizationId: task.organization_id,
      title: task.title,
      description: task.description,
      createdBy: task.created_by,
      assignedTo: task.assigned_to,
      assignedTenantId: task.assigned_tenant_id,
      dueDate: safeToISOString(task.due_date),
      priority: task.priority,
      status: task.status,
      attachments: task.attachments || [],
      createdAt: safeToISOString(task.created_at) || '',
      updatedAt: safeToISOString(task.updated_at),
    });
  } catch (error: any) {
    console.error('Error updating task:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]
 * Delete a task
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
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
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
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

    // Check if user can delete tasks
    const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
    const taskPermission = objectPermissions.find(p => p.objectType === 'Task');
    const canDeleteTasks = taskPermission?.canDelete || false;

    if (!canDeleteTasks) {
      return NextResponse.json(
        { error: 'You do not have permission to delete tasks' },
        { status: 403 }
      );
    }

    // Get existing task
    const existingTask = await db.selectOne<{
      id: string;
      organization_id: string;
    }>('tasks', {
      eq: { id },
    });

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Verify task belongs to user's organization
    if (existingTask.organization_id !== organization.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Delete task
    await db.delete('tasks', {
      eq: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

