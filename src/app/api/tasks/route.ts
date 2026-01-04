import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { logEntityCreated, getRequestMetadata } from '@/lib/activity-tracker';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { z } from 'zod';

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  assignedTenantId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'waiting', 'done']).default('todo'),
  attachments: z.array(z.string()).optional(),
});

/**
 * Helper function to safely convert date to ISO string
 * Handles strings, Date objects, timestamps, and other date-like values
 */
function toISOString(date: any): string | null {
  if (!date) return null;
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString();
  // Try to convert to Date if it's a number or other type
  try {
    const dateObj = new Date(date);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString();
    }
  } catch (e) {
    // Ignore conversion errors
  }
  return null;
}

/**
 * GET /api/tasks
 * Get all tasks for the current user's organization
 * Returns tasks where user is creator OR assigned to
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

    const organization = await getCurrentOrganization();
    if (!organization) {
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

    // Check if user can read tasks (canRead on Task object)
    const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
    const taskPermission = objectPermissions.find(p => p.objectType === 'Task');
    const canReadTasks = taskPermission?.canRead || false;

    if (!canReadTasks) {
      return NextResponse.json(
        { error: 'You do not have permission to view tasks' },
        { status: 403 }
      );
    }

    // Get all tasks for the organization where user is creator OR assigned to
    // This allows users to see tasks they created or tasks assigned to them
    const tasks = await db.select<{
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
      eq: { organization_id: organization.id },
      // Filter: show tasks where user is creator OR assigned to
      // We'll filter in the query or after fetching
    });

    // Filter tasks: user must be creator OR assigned to
    const filteredTasks = tasks.filter(
      (task) => task.created_by === userId || task.assigned_to === userId
    );

    // Map snake_case to camelCase for API response
    const mappedTasks = filteredTasks.map((task) => ({
      id: task.id,
      organizationId: task.organization_id,
      title: task.title,
      description: task.description,
      createdBy: task.created_by,
      assignedTo: task.assigned_to,
      assignedTenantId: task.assigned_tenant_id,
      dueDate: toISOString(task.due_date),
      priority: task.priority,
      status: task.status,
      attachments: task.attachments || [],
      createdAt: toISOString(task.created_at) || '',
      updatedAt: toISOString(task.updated_at),
    }));

    return NextResponse.json(mappedTasks);
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Create a new task
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

    const organization = await getCurrentOrganization();
    if (!organization) {
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

    // Check if user can create tasks (canCreate on Task object)
    const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
    const taskPermission = objectPermissions.find(p => p.objectType === 'Task');
    const canCreateTasks = taskPermission?.canCreate || false;

    if (!canCreateTasks) {
      return NextResponse.json(
        { error: 'You do not have permission to create tasks' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createTaskSchema.parse(body);

    // Create task
    const newTask = await db.insertOne<{
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
      created_at: Date | string;
      updated_at: Date | null;
    }>('tasks', {
      organization_id: organization.id,
      title: validatedData.title,
      description: validatedData.description || null,
      created_by: userId,
      assigned_to: validatedData.assignedTo || null,
      assigned_tenant_id: validatedData.assignedTenantId || null,
      due_date: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
      priority: validatedData.priority,
      status: validatedData.status,
      attachments: validatedData.attachments || [],
    });

    if (!newTask) {
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    // Log activity
    const requestHeaders = await headers();
    const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
    await logEntityCreated(
      organization.id,
      'task',
      newTask.id,
      userId,
      validatedData.title,
      {
        priority: validatedData.priority,
        status: validatedData.status,
        assignedTo: validatedData.assignedTo,
        ipAddress,
        userAgent,
      }
    );

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: newTask.id,
      organizationId: newTask.organization_id,
      title: newTask.title,
      description: newTask.description,
      createdBy: newTask.created_by,
      assignedTo: newTask.assigned_to,
      assignedTenantId: newTask.assigned_tenant_id,
      dueDate: toISOString(newTask.due_date),
      priority: newTask.priority,
      status: newTask.status,
      attachments: newTask.attachments || [],
      createdAt: toISOString(newTask.created_at) || '',
      updatedAt: toISOString(newTask.updated_at),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task:', error);
    
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

