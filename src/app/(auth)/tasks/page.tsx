'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  MoreHorizontal,
  Paperclip,
  MapPin,
  Calendar,
  User,
  Phone,
  DollarSign,
  FileText,
  Loader2,
  GripVertical,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { useDataQuery } from '@/hooks/use-query';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseRealtimeTasks } from '@/hooks/use-supabase-realtime';
import { useOrganization } from '@/hooks/use-organization';
import { useAuth } from '@/hooks/use-auth';
import { AccessDenied } from '@/components/ui/access-denied';
import { AccessDeniedAction } from '@/components/ui/access-denied-action';
import { PageLoader } from '@/components/ui/page-loader';
import { usePageAccess } from '@/hooks/use-page-access';
import { FeatureGate } from '@/components/features/FeatureGate';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { format, parseISO, isToday, isTomorrow, isPast, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Fetch tasks from API
async function getTasks() {
  const response = await fetch('/api/tasks', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch tasks');
  }
  return response.json();
}

const statusConfig = {
  todo: {
    label: 'À Faire',
    color: 'bg-gray-100 text-gray-800',
    dotColor: 'bg-gray-400',
  },
  in_progress: {
    label: 'En Cours',
    color: 'bg-blue-100 text-blue-800',
    dotColor: 'bg-blue-500',
  },
  waiting: {
    label: 'En Révision',
    color: 'bg-yellow-100 text-yellow-800',
    dotColor: 'bg-yellow-500',
  },
  done: {
    label: 'Terminé',
    color: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500',
  },
};

const priorityConfig = {
  low: {
    label: 'Faible',
    color: 'bg-green-100 text-green-800',
  },
  medium: {
    label: 'Moyen',
    color: 'bg-yellow-100 text-yellow-800',
  },
  high: {
    label: 'Élevé',
    color: 'bg-orange-100 text-orange-800',
  },
  urgent: {
    label: 'Urgent',
    color: 'bg-red-100 text-red-800',
  },
};

type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'done';

// Helper functions
const formatDueDate = (dueDate: string | Date | null) => {
  if (!dueDate) return null;
  const d = typeof dueDate === 'string' ? parseISO(dueDate) : new Date(dueDate);
  
  if (isToday(d)) {
    return `Aujourd'hui ${format(d, 'HH:mm', { locale: fr })}`;
  }
  if (isTomorrow(d)) {
    return `Demain ${format(d, 'HH:mm', { locale: fr })}`;
  }
  return format(d, 'EEEE HH:mm', { locale: fr });
};

const isOverdue = (dueDate: string | Date | null) => {
  if (!dueDate) return false;
  const d = typeof dueDate === 'string' ? parseISO(dueDate) : new Date(dueDate);
  return isPast(d) && !isToday(d);
};

function SortableTaskCard({ task }: { task: any }) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dueDateFormatted = formatDueDate(task.dueDate);
  const overdue = isOverdue(task.dueDate);
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on drag handle or menu button
    const target = e.target as HTMLElement;
    if (target.closest('[data-drag-handle]') || target.closest('[data-menu-button]')) {
      return;
    }
    router.push(`/tasks/${task.id}`);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className={cn("mb-4 hover:shadow-md transition-shadow cursor-pointer", isDragging && "ring-2 ring-blue-500")}
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  {...attributes} 
                  {...listeners} 
                  className="cursor-grab active:cursor-grabbing mr-1"
                  data-drag-handle
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="h-4 w-4 text-gray-400" />
                </div>
                <Badge className={priority.color} variant="outline">
                  {priority.label}
                </Badge>
                {task.status === 'in_progress' && (
                  <Badge className="bg-blue-100 text-blue-800" variant="outline">
                    En cours
                  </Badge>
                )}
                {task.status === 'waiting' && (
                  <Badge className="bg-yellow-100 text-yellow-800" variant="outline">
                    Révision
                  </Badge>
                )}
                {task.status === 'done' && (
                  <Badge className="bg-green-100 text-green-800" variant="outline">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Terminé
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              data-menu-button
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Open task menu
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {dueDateFormatted && (
            <div className={cn(
              "flex items-center gap-2 text-sm mb-2",
              overdue ? "text-red-600" : "text-gray-600"
            )}>
              <Calendar className="h-4 w-4" />
              <span>{dueDateFormatted}</span>
              {overdue && (
                <Badge className="bg-red-100 text-red-800 text-xs">
                  En retard
                </Badge>
              )}
            </div>
          )}

          {task.assignedUserName && (
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarImage 
                  src={task.assignedUserAvatar || `https://ui-avatars.com/api/?name=${task.assignedUserName}`} 
                  alt={task.assignedUserName} 
                />
                <AvatarFallback className="text-xs">
                  {task.assignedUserName.split(' ').map((n: string) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-600">{task.assignedUserName}</span>
            </div>
          )}

          {task.attachments && task.attachments.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Paperclip className="h-4 w-4" />
              <span>{task.attachments.length} pièce{task.attachments.length > 1 ? 's' : ''} jointe{task.attachments.length > 1 ? 's' : ''}</span>
            </div>
          )}

          {task.status === 'in_progress' && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>70% complété</span>
                <span>Documents manquants</span>
              </div>
              <Progress value={70} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TasksPage() {
  const { canAccessObject, isLoading: isAccessLoading } = usePageAccess();
  const { organizationId, isLoading: isLoadingOrg } = useOrganization();
  const { userId } = useAuth();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: tasks, isLoading } = useDataQuery(['tasks'], getTasks);
  const queryClient = useQueryClient();

  // Wait for access data to load
  if (isAccessLoading || isLoading) {
    return <PageLoader message="Chargement..." />;
  }

  // Enable real-time updates for tasks
  // Pass only organizationId to listen to all tasks in the organization
  // The API filters tasks by created_by OR assigned_to, so we need to listen to all org tasks
  // Only enable real-time once organizationId is available
  useSupabaseRealtimeTasks(organizationId || undefined);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate statistics - must be before any conditional returns
  const activeTasks = tasks?.filter((t: any) => 
    t.status !== 'done'
  ) || [];
  
  const overdueTasks = tasks?.filter((t: any) => {
    if (t.status === 'done' || !t.dueDate) return false;
    const dueDate = typeof t.dueDate === 'string' ? parseISO(t.dueDate) : new Date(t.dueDate);
    return isPast(dueDate) && !isToday(dueDate);
  }) || [];

  // Group tasks by status - use useMemo to ensure it recalculates when tasks change
  // Must be before any conditional returns to maintain hook order
  const tasksByStatus = useMemo(() => {
    if (!tasks) {
      return {
        todo: [],
        in_progress: [],
        waiting: [],
        done: [],
      };
    }
    return {
      todo: tasks.filter((t: any) => t.status === 'todo'),
      in_progress: tasks.filter((t: any) => t.status === 'in_progress'),
      waiting: tasks.filter((t: any) => t.status === 'waiting'),
      done: tasks.filter((t: any) => t.status === 'done'),
    };
  }, [tasks]);

  const canCreate = canAccessObject('Task', 'create');
  const canEdit = canAccessObject('Task', 'edit');

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Check if user can edit tasks
    if (!canEdit) {
      toast.error('Vous n\'avez pas la permission de modifier les tâches');
      return;
    }

    const taskId = active.id as string;
    
    // Determine the target status
    // If dropped on a column (status), use that status
    // If dropped on another task, use that task's status
    let newStatus: TaskStatus;
    
    if (['todo', 'in_progress', 'waiting', 'done'].includes(over.id as string)) {
      // Dropped directly on a column
      newStatus = over.id as TaskStatus;
    } else {
      // Dropped on another task, get its status
      const targetTask = tasks?.find((t: any) => t.id === over.id);
      if (!targetTask) return;
      newStatus = targetTask.status as TaskStatus;
    }

    // Find the task being moved
    const task = tasks?.find((t: any) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    const previousTasks = tasks;
    queryClient.setQueryData(['tasks'], (old: any) => {
      if (!old) return old;
      return old.map((t: any) => 
        t.id === taskId ? { ...t, status: newStatus } : t
      );
    });

    try {
      console.log(`Updating task ${taskId} to status ${newStatus}`);
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update task status');
      }

      const updatedTask = await response.json();
      console.log('Task updated successfully:', updatedTask);

      // Update the cache with the actual response from server
      // Note: Real-time will also update this, but this ensures immediate UI update
      queryClient.setQueryData(['tasks'], (old: any) => {
        if (!old) return old;
        return old.map((t: any) => 
          t.id === taskId ? {
            ...t,
            status: updatedTask.status || newStatus,
            updatedAt: updatedTask.updatedAt || new Date().toISOString(),
          } : t
        );
      });
      
      // Real-time will handle the update for other clients
      // No need to invalidate here as real-time will update the cache

      toast.success('Statut de la tâche mis à jour');
      
      // Real-time will automatically update via useSupabaseRealtimeTasks
      // Don't invalidate here to avoid interfering with real-time updates
      // The optimistic update above is sufficient for immediate UI feedback
    } catch (error) {
      // Revert on error
      queryClient.setQueryData(['tasks'], previousTasks);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la mise à jour du statut';
      toast.error(errorMessage);
      console.error('Error updating task status:', error);
    }
  };

  const activeTask = activeId ? tasks?.find((t: any) => t.id === activeId) : null;

  // Droppable Column Component
  function DroppableColumn({ status, config, tasks, isLoading }: { status: TaskStatus; config: any; tasks: any[]; isLoading: boolean }) {
    const { setNodeRef, isOver } = useDroppable({
      id: status,
    });

    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className={cn("h-2 w-2 rounded-full", config.dotColor)} />
          <h2 className="font-semibold text-gray-900">{config.label}</h2>
          <Badge variant="secondary" className="ml-auto">
            {tasks.length}
          </Badge>
        </div>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 space-y-4 overflow-y-auto max-h-[calc(100vh-300px)] min-h-[200px] p-2 rounded-lg transition-colors",
            isOver ? "bg-blue-100 border-2 border-blue-300 border-dashed" : "bg-gray-50"
          )}
        >
          <SortableContext
            items={tasks.map((t: any) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : tasks.length > 0 ? (
              tasks.map((task: any) => (
                <SortableTaskCard key={task.id} task={task} />
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune tâche</p>
              </div>
            )}
          </SortableContext>
        </div>
      </div>
    );
  }

  return (
    <FeatureGate
      feature="maintenance_requests"
      showUpgrade={true}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Tâches</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span>
                {isLoading ? '...' : activeTasks.length} tâche{activeTasks.length > 1 ? 's' : ''} active{activeTasks.length > 1 ? 's' : ''}
              </span>
              {overdueTasks.length > 0 && (
                <span className="text-red-600 font-semibold">
                  {overdueTasks.length} en retard
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className={viewMode === 'kanban' ? 'bg-white shadow-sm' : ''}
              >
                Kanban
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-white shadow-sm' : ''}
              >
                Liste
              </Button>
            </div>
            {canCreate ? (
              <Link href="/tasks/new">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle tâche
                </Button>
              </Link>
            ) : (
              <AccessDeniedAction
                requiredPermission="Créer des tâches"
                reason="permission"
                featureName="Gestion des tâches"
              >
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle tâche
                </Button>
              </AccessDeniedAction>
            )}
          </div>
        </div>

        {/* Kanban Board */}
        {viewMode === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['todo', 'in_progress', 'waiting', 'done'] as const).map((status) => {
              const config = statusConfig[status];
              const statusTasks = tasksByStatus[status];

              return (
                <DroppableColumn key={status} status={status} config={config} tasks={statusTasks} isLoading={isLoading} />
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : tasks && tasks.length > 0 ? (
                <div className="space-y-4">
                  {tasks.map((task: any) => (
                    <SortableTaskCard key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Aucune tâche
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Commencez par créer votre première tâche.
                  </p>
                  {canCreate ? (
                    <Link href="/tasks/new">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle tâche
                      </Button>
                    </Link>
                  ) : (
                    <AccessDeniedAction
                      requiredPermission="Créer des tâches"
                      reason="permission"
                      featureName="Gestion des tâches"
                    >
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled>
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle tâche
                      </Button>
                    </AccessDeniedAction>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <DragOverlay>
          {activeTask ? (
            <Card className="w-[300px] opacity-90 rotate-3">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900">{activeTask.title}</h3>
                {activeTask.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">{activeTask.description}</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
      </PermissionGate>
    </FeatureGate>
  );
}
