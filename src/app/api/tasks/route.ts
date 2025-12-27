import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db, supabaseAdmin } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { getEnabledPlanFeatures } from '@/lib/plan-features';
import { z } from 'zod';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().nullable().optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  assignedTenantId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'waiting', 'done']).default('todo'),
  attachments: z.array(z.string()).optional(),
});

/**
 * GET /api/tasks
 * Get all tasks for the current organization
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

    // Check plan feature
    const planFeatures = await getEnabledPlanFeatures(user.planName || 'freemium');
    if (!planFeatures.has('basic_tasks')) {
      return NextResponse.json(
        { error: 'Forbidden: Tasks feature is not available in your plan' },
        { status: 403 }
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
        { error: 'Forbidden: You do not have permission to view tasks' },
        { status: 403 }
      );
    }

    // Get tasks - users see only tasks they created or are assigned to
    // If user has canViewAll, show all tasks in organization
    const canViewAllTasks = taskPermission?.canViewAll || false;
    
    let allTasks: any[] = [];

    if (canViewAllTasks) {
      // User can view all tasks in organization
      const allOrgTasks = await supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('organization_id', user.organizationId);
      allTasks = allOrgTasks.data || [];
    } else {
      // User can only see tasks they created or are assigned to
      const tasksCreated = await supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('organization_id', user.organizationId)
        .eq('created_by', user.id);

      const tasksAssigned = await supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('organization_id', user.organizationId)
        .eq('assigned_to', user.id);

      // Combine and deduplicate tasks
      const combined = [...(tasksCreated.data || []), ...(tasksAssigned.data || [])];
      allTasks = Array.from(
        new Map(combined.map((task: any) => [task.id, task])).values()
      );
    }

    const tasksData = allTasks as Array<{
      id: string;
      organization_id: string;
      created_by: string | null;
      assigned_to: string | null;
      assigned_tenant_id: string | null;
      title: string;
      description: string | null;
      due_date: Date | string | null;
      priority: string;
      status: string;
      attachments: string[] | null;
      created_at: Date | string;
      updated_at: Date | string | null;
    }>;

    // Get unique user IDs (creators and assignees) to fetch user details
    const userIds = new Set<string>();
    tasksData.forEach(task => {
      if (task.created_by) userIds.add(task.created_by);
      if (task.assigned_to) userIds.add(task.assigned_to);
    });

    const userMap = new Map<string, { first_name: string | null; last_name: string | null; avatar_url: string | null }>();
    if (userIds.size > 0) {
      const userRecords = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, avatar_url')
        .in('id', Array.from(userIds));

      (userRecords.data || []).forEach((u: any) => {
        userMap.set(u.id, u);
      });
    }

    // Get tenant details for tasks that have assigned tenants
    const tenantIds = tasksData
      .map(task => task.assigned_tenant_id)
      .filter((id): id is string => id !== null);

    const tenantMap = new Map<string, { first_name: string; last_name: string }>();
    if (tenantIds.length > 0) {
      // Fetch all tenants in one query
      const tenantRecords = await supabaseAdmin
        .from('tenants')
        .select('id, first_name, last_name')
        .in('id', tenantIds);

      (tenantRecords.data || []).forEach((tenant: any) => {
        tenantMap.set(tenant.id, tenant);
      });
    }

    // Map tasks with details
    const tasksWithDetails = tasksData.map((task) => {
      const tenant = task.assigned_tenant_id ? tenantMap.get(task.assigned_tenant_id) : null;
      const creator = task.created_by ? userMap.get(task.created_by) : null;
      const assignee = task.assigned_to ? userMap.get(task.assigned_to) : null;

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        createdBy: task.created_by,
        createdByName: creator ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim() : null,
        createdByAvatar: creator?.avatar_url || null,
        assignedTo: task.assigned_to,
        assignedUserName: assignee ? `${assignee.first_name || ''} ${assignee.last_name || ''}`.trim() : null,
        assignedUserAvatar: assignee?.avatar_url || null,
        assignedTenantId: task.assigned_tenant_id,
        assignedTenantName: tenant ? `${tenant.first_name} ${tenant.last_name}` : null,
        dueDate: task.due_date,
        priority: task.priority,
        status: task.status,
        attachments: task.attachments || [],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      };
    });

    return NextResponse.json(tasksWithDetails);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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

    // Check plan feature
    const planFeatures = await getEnabledPlanFeatures(user.planName || 'freemium');
    if (!planFeatures.has('basic_tasks')) {
      return NextResponse.json(
        { error: 'Forbidden: Tasks feature is not available in your plan' },
        { status: 403 }
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
        { error: 'Forbidden: You do not have permission to create tasks' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createTaskSchema.parse(body);

    // If assignedTo is set, verify it's allowed (only users with edit permission can assign to others)
    if (validatedData.assignedTo && validatedData.assignedTo !== user.id) {
      const canEditTasks = taskPermission?.canEdit || false;
      if (!canEditTasks) {
        return NextResponse.json(
          { error: 'Forbidden: You can only assign tasks to yourself' },
          { status: 403 }
        );
      }
    }

    // Create task
    const now = new Date();
    const newTask = await db.insertOne<{
      id: string;
      organization_id: string;
      created_by: string;
      assigned_to: string;
      assigned_tenant_id: string | null;
      title: string;
      description: string | null;
      due_date: Date | string | null;
      priority: string;
      status: string;
      attachments: string[] | null;
      created_at: Date | string;
      updated_at: Date | string | null;
    }>('tasks', {
      organization_id: user.organizationId,
      created_by: user.id, // Track who created the task
      title: validatedData.title,
      description: validatedData.description || null,
      assigned_to: validatedData.assignedTo || user.id, // Default to creator if not specified
      assigned_tenant_id: validatedData.assignedTenantId || null,
      due_date: validatedData.dueDate ? new Date(validatedData.dueDate).toISOString() : null,
      priority: validatedData.priority,
      status: validatedData.status,
      attachments: validatedData.attachments || [],
      updated_at: now.toISOString(), // Set updatedAt on creation
    });

    if (!newTask) {
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    // Create activity log entry (only if task_activities table exists)
    try {
      await db.insert('task_activities', {
        task_id: newTask.id,
        user_id: user.id,
        action: 'created',
        description: `Tâche "${validatedData.title}" créée`,
        metadata: validatedData.title ? {
          title: validatedData.title,
          priority: validatedData.priority,
          status: validatedData.status,
        } : null,
      });
    } catch (activityError) {
      // Log the error but don't fail the task creation if activity logging fails
      console.warn('Failed to create task activity log:', activityError);
      // Continue - task creation is more important than activity logging
    }

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: newTask.id,
      organizationId: newTask.organization_id,
      createdBy: newTask.created_by,
      assignedTo: newTask.assigned_to,
      assignedTenantId: newTask.assigned_tenant_id,
      title: newTask.title,
      description: newTask.description,
      dueDate: newTask.due_date,
      priority: newTask.priority,
      status: newTask.status,
      attachments: newTask.attachments,
      createdAt: newTask.created_at,
      updatedAt: newTask.updated_at,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues);
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating task:', error);
    
    // Provide more detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
