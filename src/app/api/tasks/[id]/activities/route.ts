import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { taskActivities, tasks, users } from '@/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/tasks/[id]/activities
 * Get all activities for a specific task
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

    // Verify task exists and user has access (creator or assignee)
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    const task = taskRecords[0];

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Verify task belongs to user's organization
    if (task.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if user is creator or assignee
    const isCreator = task.createdBy === user.id;
    const isAssignee = task.assignedTo === user.id;

    if (!isCreator && !isAssignee) {
      return NextResponse.json(
        { error: 'Forbidden: You can only view activities for tasks you created or are assigned to' },
        { status: 403 }
      );
    }

    // Get activities with user details
    const activitiesList = await db
      .select({
        id: taskActivities.id,
        taskId: taskActivities.taskId,
        userId: taskActivities.userId,
        action: taskActivities.action,
        fieldName: taskActivities.fieldName,
        oldValue: taskActivities.oldValue,
        newValue: taskActivities.newValue,
        description: taskActivities.description,
        metadata: taskActivities.metadata,
        createdAt: taskActivities.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userAvatarUrl: users.avatarUrl,
      })
      .from(taskActivities)
      .leftJoin(users, eq(taskActivities.userId, users.id))
      .where(eq(taskActivities.taskId, id))
      .orderBy(desc(taskActivities.createdAt));

    const activities = activitiesList.map(activity => ({
      id: activity.id,
      taskId: activity.taskId,
      userId: activity.userId,
      user: activity.userId ? {
        id: activity.userId,
        firstName: activity.userFirstName,
        lastName: activity.userLastName,
        avatarUrl: activity.userAvatarUrl,
        name: `${activity.userFirstName || ''} ${activity.userLastName || ''}`.trim(),
      } : null,
      action: activity.action,
      fieldName: activity.fieldName,
      oldValue: activity.oldValue,
      newValue: activity.newValue,
      description: activity.description,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
    }));

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching task activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

