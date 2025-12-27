import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db, supabaseAdmin } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  assignedTenantId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in_progress', 'waiting', 'done']).optional(),
  attachments: z.array(z.string()).optional(),
});

/**
 * GET /api/tasks/[id]
 * Get a single task with its activities
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

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;

    // Get task
    const task = await db.selectOne<{
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
    if (task.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check permissions: only creator or assignee can view
    const isCreator = task.created_by === user.id;
    const isAssignee = task.assigned_to === user.id;

    if (!isCreator && !isAssignee) {
      return NextResponse.json(
        { error: 'Forbidden: You can only view tasks you created or are assigned to' },
        { status: 403 }
      );
    }

    // Get creator and assignee details
    const creator = task.created_by ? await db.selectOne<{
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    }>('users', {
      eq: { id: task.created_by },
    }) : null;

    const assignee = task.assigned_to ? await db.selectOne<{
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    }>('users', {
      eq: { id: task.assigned_to },
    }) : null;

    const assignedTenant = task.assigned_tenant_id ? await db.selectOne<{
      first_name: string;
      last_name: string;
    }>('tenants', {
      eq: { id: task.assigned_tenant_id },
    }) : null;

    // Get activities
    const activitiesList = await supabaseAdmin
      .from('task_activities')
      .select('*,users(first_name,last_name,avatar_url)')
      .eq('task_id', id)
      .order('created_at', { ascending: false });

    const activities = (activitiesList.data || []).map((activity: any) => {
      const user = activity.users;
      return {
        id: activity.id,
        userId: activity.user_id,
        user: activity.user_id && user ? {
          id: activity.user_id,
          firstName: user.first_name,
          lastName: user.last_name,
          avatarUrl: user.avatar_url,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        } : null,
        action: activity.action,
        fieldName: activity.field_name,
        oldValue: activity.old_value,
        newValue: activity.new_value,
        description: activity.description,
        metadata: activity.metadata,
        createdAt: activity.created_at,
      };
    });

    return NextResponse.json({
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
      assignedTenantName: assignedTenant ? `${assignedTenant.first_name} ${assignedTenant.last_name}` : null,
      dueDate: task.due_date,
      priority: task.priority,
      status: task.status,
      attachments: task.attachments || [],
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      activities,
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tasks/[id]
 * Update a task (especially status for drag and drop)
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

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;
    const body = await req.json();
    const validatedData = updateTaskSchema.parse(body);

    // Check if task exists and belongs to organization
    const task = await db.selectOne<{
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
    if (task.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check permissions: only creator or assignee can view/edit
    const isCreator = task.created_by === user.id;
    const isAssignee = task.assigned_to === user.id;

    if (!isCreator && !isAssignee) {
      return NextResponse.json(
        { error: 'Forbidden: You can only view/edit tasks you created or are assigned to' },
        { status: 403 }
      );
    }

    // Build update object and track changes
    const updateData: Record<string, any> = {};
    const activities: Array<{
      action: string;
      field_name?: string;
      old_value?: string | null;
      new_value?: string | null;
      description: string;
    }> = [];

    if (validatedData.title !== undefined && validatedData.title !== task.title) {
      activities.push({
        action: 'updated',
        field_name: 'title',
        old_value: task.title || null,
        new_value: validatedData.title,
        description: `Titre modifié de "${task.title}" à "${validatedData.title}"`,
      });
      updateData.title = validatedData.title;
    }

    if (validatedData.description !== undefined && validatedData.description !== task.description) {
      activities.push({
        action: 'updated',
        field_name: 'description',
        old_value: task.description || null,
        new_value: validatedData.description || null,
        description: 'Description modifiée',
      });
      updateData.description = validatedData.description;
    }

    if (validatedData.assignedTo !== undefined && validatedData.assignedTo !== task.assigned_to) {
      activities.push({
        action: 'assigned',
        field_name: 'assigned_to',
        old_value: task.assigned_to || null,
        new_value: validatedData.assignedTo || null,
        description: validatedData.assignedTo 
          ? `Tâche assignée à un autre utilisateur`
          : 'Assignation retirée',
      });
      updateData.assigned_to = validatedData.assignedTo;
    }

    if (validatedData.assignedTenantId !== undefined && validatedData.assignedTenantId !== task.assigned_tenant_id) {
      activities.push({
        action: 'updated',
        field_name: 'assigned_tenant_id',
        old_value: task.assigned_tenant_id || null,
        new_value: validatedData.assignedTenantId || null,
        description: 'Locataire assigné modifié',
      });
      updateData.assigned_tenant_id = validatedData.assignedTenantId;
    }

    if (validatedData.dueDate !== undefined) {
      const newDueDate = validatedData.dueDate ? new Date(validatedData.dueDate).toISOString() : null;
      const oldDueDate = task.due_date ? new Date(task.due_date).toISOString() : null;
      if (newDueDate !== oldDueDate) {
        activities.push({
          action: 'updated',
          field_name: 'due_date',
          old_value: oldDueDate,
          new_value: newDueDate,
          description: `Date d'échéance modifiée`,
        });
        updateData.due_date = validatedData.dueDate ? new Date(validatedData.dueDate).toISOString() : null;
      }
    }

    if (validatedData.priority !== undefined && validatedData.priority !== task.priority) {
      activities.push({
        action: 'updated',
        field_name: 'priority',
        old_value: task.priority || null,
        new_value: validatedData.priority,
        description: `Priorité modifiée de "${task.priority}" à "${validatedData.priority}"`,
      });
      updateData.priority = validatedData.priority;
    }

    if (validatedData.status !== undefined && validatedData.status !== task.status) {
      activities.push({
        action: 'status_changed',
        field_name: 'status',
        old_value: task.status || null,
        new_value: validatedData.status,
        description: `Statut modifié de "${task.status}" à "${validatedData.status}"`,
      });
      updateData.status = validatedData.status;
    }

    if (validatedData.attachments !== undefined) {
      const oldAttachments = JSON.stringify(task.attachments || []);
      const newAttachments = JSON.stringify(validatedData.attachments || []);
      if (oldAttachments !== newAttachments) {
        activities.push({
          action: 'attachment_added',
          field_name: 'attachments',
          old_value: oldAttachments,
          new_value: newAttachments,
          description: 'Pièces jointes modifiées',
        });
        updateData.attachments = validatedData.attachments;
      }
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      console.log('Updating task:', { id, updateData, filter: { id } });

      // Update task using Supabase
      let updatedTask;
      try {
        updatedTask = await db.updateOne<{
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
      }>('tasks', updateData, { id });
      } catch (updateError) {
        console.error('Error in db.updateOne:', updateError);
        throw updateError;
      }

      if (!updatedTask) {
        console.error('Failed to update task: updateOne returned null');
        console.error('Update data was:', updateData);
        console.error('Filter was:', { id });
        return NextResponse.json(
          { error: 'Failed to update task: no data returned' },
          { status: 500 }
        );
      }

      console.log('Task updated successfully:', updatedTask.id);

      // Create activity log entries for each change
      if (activities.length > 0) {
        for (const activity of activities) {
          try {
            await db.insertOne('task_activities', {
              task_id: id,
              user_id: user.id,
              action: activity.action,
              field_name: activity.field_name,
              old_value: activity.old_value,
              new_value: activity.new_value,
              description: activity.description,
            });
          } catch (activityError) {
            // Log but don't fail the update if activity logging fails
            console.warn('Failed to create task activity:', activityError);
          }
        }
      }

      // Map to camelCase for response
      return NextResponse.json({
        id: updatedTask.id,
        organizationId: updatedTask.organization_id,
        createdBy: updatedTask.created_by,
        assignedTo: updatedTask.assigned_to,
        assignedTenantId: updatedTask.assigned_tenant_id,
        title: updatedTask.title,
        description: updatedTask.description,
        dueDate: updatedTask.due_date,
        priority: updatedTask.priority,
        status: updatedTask.status,
        attachments: updatedTask.attachments || [],
        createdAt: updatedTask.created_at,
        updatedAt: updatedTask.updated_at,
      });
    } else {
      // No changes, return current task mapped to camelCase
      return NextResponse.json({
        id: task.id,
        organizationId: task.organization_id,
        createdBy: task.created_by,
        assignedTo: task.assigned_to,
        assignedTenantId: task.assigned_tenant_id,
        title: task.title,
        description: task.description,
        dueDate: task.due_date,
        priority: task.priority,
        status: task.status,
        attachments: task.attachments || [],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorDetails = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: errorMessage,
        ...(process.env.NODE_ENV === 'development' && errorDetails ? { details: errorDetails } : {})
      },
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

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;

    // Check if task exists and belongs to organization
    const task = await db.selectOne<{
      id: string;
      organization_id: string;
      created_by: string | null;
      assigned_to: string | null;
    }>('tasks', {
      eq: { id },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (task.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check permissions: only creator or assignee can delete
    const isCreator = task.created_by === user.id;
    const isAssignee = task.assigned_to === user.id;

    if (!isCreator && !isAssignee) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete tasks you created or are assigned to' },
        { status: 403 }
      );
    }

    // Delete task (cascade will delete activities)
    await db.deleteOne('tasks', { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

