'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  FileText,
  Paperclip,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
  MoreVertical,
  Building2,
  MapPin,
  Loader2,
} from 'lucide-react';
import { TaskAttachments } from '@/components/tasks/task-attachments';
import { useDataQuery } from '@/hooks/use-query';
import { useQueryClient } from '@tanstack/react-query';
import { usePageAccess } from '@/hooks/use-page-access';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/features/FeatureGate';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

// Fetch task details from API
async function getTaskDetails(id: string) {
  const response = await fetch(`/api/tasks/${id}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch task details');
  }
  return response.json();
}

// Fetch users from API
async function getUsers() {
  const response = await fetch('/api/organization/users', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
}

const statusConfig = {
  todo: {
    label: 'À Faire',
    color: 'bg-gray-100 text-foreground',
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
    icon: CheckCircle2,
  },
  medium: {
    label: 'Moyen',
    color: 'bg-yellow-100 text-yellow-800',
    icon: AlertCircle,
  },
  high: {
    label: 'Élevé',
    color: 'bg-orange-100 text-orange-800',
    icon: AlertCircle,
  },
  urgent: {
    label: 'Urgent',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
};

export default function TaskDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const taskId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'todo' as 'todo' | 'in_progress' | 'waiting' | 'done',
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');

  const { data: task, isLoading, error, refetch } = useDataQuery(
    ['task', taskId || 'unknown'],
    () => getTaskDetails(taskId!),
    { enabled: !!taskId }
  );

  const { data: usersData } = useDataQuery(
    ['organization-users'],
    getUsers
  );

  const users = usersData?.users || [];

  const { canAccessObject, isLoading: isAccessLoading } = usePageAccess();

  // Filter users based on search term
  const filteredUsers = users.filter((user: any) => {
    if (!userSearchTerm) return true;
    const searchLower = userSearchTerm.toLowerCase();
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    return fullName.includes(searchLower) || email.includes(searchLower);
  });

  // Initialize form when task loads
  useEffect(() => {
    if (task) {
      setEditForm({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        status: task.status || 'todo',
      });
      if (task.dueDate) {
        const date = typeof task.dueDate === 'string' ? parseISO(task.dueDate) : new Date(task.dueDate);
        setDueDate(format(date, 'yyyy-MM-dd'));
        setDueTime(format(date, 'HH:mm'));
      }
      setSelectedUserId(task.assignedTo || null);
    }
  }, [task]);

  const handleEditTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          priority: editForm.priority,
          status: editForm.status,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la modification');
      }

      toast.success('Tâche modifiée avec succès!');
      setShowEditDialog(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification');
    }
  };

  const handleReassign = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignedTo: selectedUserId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la réassignation');
      }

      toast.success('Tâche réassignée avec succès!');
      setShowReassignDialog(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la réassignation');
    }
  };

  const handleUpdateDate = async () => {
    try {
      let dueDateValue = null;
      if (dueDate) {
        if (dueTime) {
          dueDateValue = `${dueDate}T${dueTime}:00`;
        } else {
          dueDateValue = `${dueDate}T00:00:00`;
        }
      }

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dueDate: dueDateValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la modification de la date');
      }

      toast.success('Date modifiée avec succès!');
      setShowDateDialog(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification de la date');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la suppression');
      }

      toast.success('Tâche supprimée avec succès!');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      router.push('/tasks');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
      setIsDeleting(false);
    }
  };

  // Wait for access data to load
  if (isAccessLoading || isLoading) {
    return <PageLoader message="Chargement..." />;
  }

  if (error || !task) {
    return (
      <div className="space-y-6">
        <Link href="/tasks">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux tâches
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Tâche introuvable
              </h3>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'Cette tâche n\'existe pas ou vous n\'avez pas accès.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[task.status as keyof typeof statusConfig];
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig];
  const PriorityIcon = priority.icon;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Non définie';
    try {
      return format(parseISO(dateString), 'dd MMMM yyyy à HH:mm', { locale: fr });
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'Non définie';
    try {
      return format(parseISO(dateString), 'dd/MM/yyyy', { locale: fr });
    } catch {
      return dateString;
    }
  };

  const canEdit = canAccessObject('Task', 'edit');
  const canDelete = canAccessObject('Task', 'delete');

  return (
    <FeatureGate
      feature="task_management"
      showUpgrade={true}
    >
      <PermissionGate
        objectType="Task"
        action="read"
        showDenied={true}
        deniedMessage="Vous n'avez pas la permission de voir les détails de cette tâche."
      >
        <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tasks">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{task.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={status.color}>{status.label}</Badge>
              <Badge className={priority.color}>
                <PriorityIcon className="h-3 w-3 mr-1" />
                {priority.label}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
          <Button variant="outline" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {task.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          {task.attachments && task.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Pièces jointes ({task.attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TaskAttachments attachments={task.attachments} />
              </CardContent>
            </Card>
          )}

          {/* Activity Log */}
          {task.activities && task.activities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historique des activités</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {task.activities.map((activity: any, index: number) => {
                    const userName = activity.user?.name || activity.userName || 'Système';
                    return (
                      <div key={activity.id || index} className="flex items-start gap-3">
                        <div className={`h-2 w-2 rounded-full mt-2 ${status.dotColor}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {userName !== 'Système' && (
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={activity.user?.avatarUrl} />
                                <AvatarFallback className="text-xs">
                                  {userName.split(' ').map((n: string) => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <p className="text-sm font-medium text-foreground">{userName}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatDateShort(activity.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Task Details */}
          <Card>
            <CardHeader>
              <CardTitle>Détails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Date d'échéance</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-foreground">{formatDate(task.dueDate)}</p>
                </div>
              </div>

              <Separator />

              {task.assignedUserName && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Assigné à</p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={task.assignedUserAvatar} />
                        <AvatarFallback>
                          {task.assignedUserName.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm text-foreground">{task.assignedUserName}</p>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {task.createdByName && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Créé par</p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={task.createdByAvatar} />
                        <AvatarFallback>
                          {task.createdByName.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm text-foreground">{task.createdByName}</p>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Date de création</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-foreground">{formatDate(task.createdAt)}</p>
                </div>
              </div>

              {task.updatedAt && task.updatedAt !== task.createdAt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Dernière modification</p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-foreground">{formatDate(task.updatedAt)}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {
                  setEditForm({
                    title: task.title || '',
                    description: task.description || '',
                    priority: task.priority || 'medium',
                    status: task.status || 'todo',
                  });
                  setShowEditDialog(true);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Modifier la tâche
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {
                  setSelectedUserId(task.assignedTo || null);
                  setUserSearchTerm('');
                  setShowReassignDialog(true);
                }}
              >
                <User className="h-4 w-4 mr-2" />
                Réassigner
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {
                  if (task.dueDate) {
                    const date = typeof task.dueDate === 'string' ? parseISO(task.dueDate) : new Date(task.dueDate);
                    setDueDate(format(date, 'yyyy-MM-dd'));
                    setDueTime(format(date, 'HH:mm'));
                  } else {
                    setDueDate('');
                    setDueTime('');
                  }
                  setShowDateDialog(true);
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Modifier la date
              </Button>
              <Separator />
              <Button 
                variant="outline" 
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Task Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la tâche</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la tâche
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Titre *</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priorité</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(value: any) => setEditForm({ ...editForm, priority: value })}
                >
                  <SelectTrigger id="edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="medium">Moyen</SelectItem>
                    <SelectItem value="high">Élevé</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Statut</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value: any) => setEditForm({ ...editForm, status: value })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">À Faire</SelectItem>
                    <SelectItem value="in_progress">En Cours</SelectItem>
                    <SelectItem value="waiting">En Révision</SelectItem>
                    <SelectItem value="done">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleEditTask}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={(open) => {
        setShowReassignDialog(open);
        if (!open) {
          setUserSearchTerm('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Réassigner la tâche</DialogTitle>
            <DialogDescription>
              Recherchez et sélectionnez un nouvel utilisateur pour cette tâche
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-search">Rechercher un utilisateur</Label>
              <div className="relative">
                <Input
                  id="user-search"
                  placeholder="Rechercher par nom ou email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="pr-10"
                />
                <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Utilisateurs disponibles</Label>
              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(null)}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors ${
                      selectedUserId === null ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        selectedUserId === null ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                      }`}>
                        {selectedUserId === null && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Aucun (non assigné)</span>
                    </div>
                  </button>
                </div>
                {filteredUsers.length > 0 ? (
                  <div className="divide-y">
                    {filteredUsers.map((user: any) => (
                      <div key={user.id} className="p-2">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors ${
                            selectedUserId === user.id ? 'bg-blue-50 border border-blue-200' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                              selectedUserId === user.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                            }`}>
                              {selectedUserId === user.id && (
                                <div className="h-2 w-2 rounded-full bg-white" />
                              )}
                            </div>
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatarUrl} />
                              <AvatarFallback>
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {user.firstName} {user.lastName}
                              </p>
                              {user.email && (
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Aucun utilisateur trouvé
                  </div>
                )}
              </div>
            </div>
            {selectedUserId && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Sélectionné :</span>{' '}
                {filteredUsers.find((u: any) => u.id === selectedUserId)?.firstName}{' '}
                {filteredUsers.find((u: any) => u.id === selectedUserId)?.lastName}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowReassignDialog(false);
              setUserSearchTerm('');
            }}>
              Annuler
            </Button>
            <Button onClick={handleReassign}>
              Réassigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Date Dialog */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la date d'échéance</DialogTitle>
            <DialogDescription>
              Définissez une nouvelle date d'échéance pour cette tâche
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due-date">Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due-time">Heure</Label>
                <Input
                  id="due-time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateDate}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la tâche</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
      </PermissionGate>
    </FeatureGate>
  );
}
