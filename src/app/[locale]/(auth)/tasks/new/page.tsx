'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  X,
  Plus,
  Loader2,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  Star,
  Calendar,
  Clock,
  Search,
  Paperclip,
  Save,
  Send,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

// Fetch units from API
async function getUnits() {
  const response = await fetch('/api/units', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch units');
  }
  return response.json();
}

// Fetch recent tasks
async function getRecentTasks() {
  const response = await fetch('/api/tasks', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch tasks');
  }
  const tasks = await response.json();
  return tasks.slice(0, 3); // Get last 3 tasks
}

const taskFormSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category: z.string(),
  assignedTo: z.string().uuid().nullable(),
  dueDate: z.string(),
  dueTime: z.string(),
  unitIds: z.array(z.string().uuid()),
  attachments: z.array(z.string()),
  sendEmailNotification: z.boolean(),
  sendSMSNotification: z.boolean(),
  createReminder: z.boolean(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

const priorityOptions = [
  { value: 'low', label: 'Faible' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high', label: 'Élevée' },
  { value: 'urgent', label: 'Urgente' },
];

const categoryOptions = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'payment', label: 'Paiement' },
  { value: 'lease', label: 'Bail' },
  { value: 'other', label: 'Autre' },
];

const statusConfig = {
  todo: { dotColor: 'bg-gray-400' },
  in_progress: { dotColor: 'bg-blue-500' },
  waiting: { dotColor: 'bg-yellow-500' },
  done: { dotColor: 'bg-green-500' },
};

export default function NewTaskPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<Array<{ id: string; label: string }>>([]);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [showUnitSearch, setShowUnitSearch] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; size: string; type: string }>>([]);

  const { data: usersData, isLoading: usersLoading } = useDataQuery(
    ['organization-users'],
    getUsers
  );
  const { data: unitsData, isLoading: unitsLoading } = useDataQuery(
    ['units'],
    getUnits
  );
  const { data: recentTasks, isLoading: recentTasksLoading } = useDataQuery(
    ['recent-tasks'],
    getRecentTasks
  );

  const { canAccessFeature, canAccessObject, isLoading: isAccessLoading } = useAccess();
  const users = usersData?.users || [];
  const units = unitsData || [];
  const filteredUnits = units.filter((unit: any) =>
    unit.unitNumber?.toLowerCase().includes(unitSearchQuery.toLowerCase()) ||
    unit.propertyName?.toLowerCase().includes(unitSearchQuery.toLowerCase())
  );

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canAccessFeature('basic_tasks', 'canCreateTasks') &&
      !canAccessObject('Task', 'create')) {
    return (
      <AccessDenied
        featureName="Création de tâches"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      category: 'maintenance',
      assignedTo: null,
      dueDate: '',
      dueTime: '',
      unitIds: [],
      attachments: [],
      sendEmailNotification: false,
      sendSMSNotification: false,
      createReminder: false,
    },
  });

  const handleUserSelect = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      const newSelection = selectedUsers.filter(id => id !== userId);
      setSelectedUsers(newSelection);
      form.setValue('assignedTo', newSelection.length > 0 ? newSelection[0] : null);
    } else {
      const newSelection = [...selectedUsers, userId];
      setSelectedUsers(newSelection);
      form.setValue('assignedTo', newSelection[0]); // For now, API only supports single assignee
    }
  };

  const handleUnitSelect = (unit: any) => {
    if (!selectedUnits.find(u => u.id === unit.id)) {
      const newUnit = {
        id: unit.id,
        label: `${unit.unitNumber} - ${unit.propertyName}`,
      };
      setSelectedUnits([...selectedUnits, newUnit]);
      form.setValue('unitIds', [...(form.getValues('unitIds') || []), unit.id]);
    }
    setShowUnitSearch(false);
    setUnitSearchQuery('');
  };

  const handleUnitRemove = (unitId: string) => {
    setSelectedUnits(selectedUnits.filter(u => u.id !== unitId));
    form.setValue('unitIds', form.getValues('unitIds')?.filter(id => id !== unitId) || []);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
        const newAttachment = {
          name: file.name,
          size: `${sizeInMB} MB`,
          type: file.type.startsWith('image/') ? 'image' : 'file',
        };
        setAttachments([...attachments, newAttachment]);
      });
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: TaskFormValues) => {
    setIsSubmitting(true);

    try {
      // Combine date and time if both are provided
      let dueDate = null;
      if (data.dueDate) {
        if (data.dueTime) {
          dueDate = `${data.dueDate}T${data.dueTime}:00`;
        } else {
          dueDate = `${data.dueDate}T00:00:00`;
        }
      }

      // Get tenant from first unit if available
      let assignedTenantId = null;
      if (data.unitIds && data.unitIds.length > 0) {
        const firstUnit = units.find((u: any) => u.id === data.unitIds[0]);
        if (firstUnit && firstUnit.tenantId) {
          assignedTenantId = firstUnit.tenantId;
        }
      }

      // Ensure assignedTo is either a valid UUID or null (not empty string)
      let assignedToValue: string | null = null;
      if (data.assignedTo && typeof data.assignedTo === 'string' && data.assignedTo.trim() !== '') {
        // Validate it's a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(data.assignedTo.trim())) {
          assignedToValue = data.assignedTo.trim();
        }
      }

      // Ensure assignedTenantId is either a valid UUID or null
      let assignedTenantIdValue: string | null = null;
      if (assignedTenantId && typeof assignedTenantId === 'string' && assignedTenantId.trim() !== '') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(assignedTenantId.trim())) {
          assignedTenantIdValue = assignedTenantId.trim();
        }
      }

      const requestBody = {
        title: data.title,
        description: data.description && data.description.trim() !== '' ? data.description.trim() : null,
        priority: data.priority,
        status: 'todo' as const,
        assignedTo: assignedToValue,
        assignedTenantId: assignedTenantIdValue,
        dueDate: dueDate,
        attachments: attachments.length > 0 ? attachments.map(a => a.name) : [],
      };

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || 'Erreur lors de la création de la tâche';
        const errorDetails = error.details ? ` Détails: ${JSON.stringify(error.details)}` : '';
        throw new Error(errorMessage + errorDetails);
      }

      const task = await response.json();
      toast.success('Tâche créée avec succès!');
      
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      // Redirect to tasks page
      router.push('/tasks');
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error(error.message || 'Erreur lors de la création de la tâche');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    // TODO: Implement save as draft functionality
    toast.info('Fonctionnalité de brouillon à venir');
  };

  const quickTips = [
    { text: "Utilisez des titres clairs et descriptifs", checked: true },
    { text: "Ajoutez toutes les pièces jointes nécessaires", checked: attachments.length > 0 },
    { text: "Définissez une date d'échéance réaliste", checked: !!form.watch('dueDate') },
    { text: "Assignez à la personne la plus qualifiée", checked: selectedUsers.length > 0 },
  ];

  const taskTemplates = [
    { title: "État des lieux entrée", description: "Visite + photos + signature" },
    { title: "Maintenance préventive", description: "Inspection trimestrielle" },
    { title: "Relance paiement", description: "Email + SMS automatique" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/tasks" className="hover:text-blue-600">Tâches</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Nouvelle tâche</span>
          </div>
          <Link href="/tasks">
            <Button variant="ghost" size="icon">
              <X className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Créer une tâche rapide</h1>
              <p className="text-muted-foreground">Assignez une tâche à votre équipe avec pièces jointes</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 min-h-screen bg-background">
              {/* Task Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Détails de la tâche</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Titre de la tâche <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      placeholder="Ex: Réparation fuite d'eau - Lot 205"
                      {...form.register('title')}
                    />
                    {form.formState.errors.title && (
                      <p className="text-sm text-red-600">{form.formState.errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Décrivez les détails de la tâche..."
                      rows={4}
                      {...form.register('description')}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">
                        Priorité <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        defaultValue="medium"
                        onValueChange={(value) => form.setValue('priority', value as any)}
                      >
                        <SelectTrigger id="priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Catégorie</Label>
                      <Select
                        defaultValue="maintenance"
                        onValueChange={(value) => form.setValue('category', value)}
                      >
                        <SelectTrigger id="category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Assign To */}
              <Card>
                <CardHeader>
                  <CardTitle>Assigner à</CardTitle>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {users.map((user: any) => {
                        const isSelected = selectedUsers.includes(user.id);
                        const roleLabels: Record<string, string> = {
                          admin: 'Administrateur',
                          agent: 'Agent',
                          accountant: 'Comptable',
                          viewer: 'Lecteur',
                        };
                        return (
                          <div
                            key={user.id}
                            onClick={() => handleUserSelect(user.id)}
                            className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                              </div>
                            )}
                            <div className="flex flex-col items-center gap-2">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={user.avatarUrl} />
                                <AvatarFallback>
                                  {user.firstName?.[0] || ''}{user.lastName?.[0] || ''}
                                </AvatarFallback>
                              </Avatar>
                              <div className="text-center">
                                <p className="font-medium text-sm">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {roleLabels[user.role] || user.role}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors">
                        <div className="flex flex-col items-center justify-center gap-2 h-full">
                          <Plus className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Ajouter</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Due Date & Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Date d'échéance & Heure</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Date d'échéance</Label>
                      <div className="relative">
                        <Input
                          id="dueDate"
                          type="date"
                          placeholder="jj/mm/aaaa"
                          {...form.register('dueDate')}
                        />
                        <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueTime">Heure</Label>
                      <div className="relative">
                        <Input
                          id="dueTime"
                          type="time"
                          placeholder="--:--"
                          {...form.register('dueTime')}
                        />
                        <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Concerned Lot */}
              <Card>
                <CardHeader>
                  <CardTitle>Lot concerné</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un lot..."
                      value={unitSearchQuery}
                      onChange={(e) => {
                        setUnitSearchQuery(e.target.value);
                        setShowUnitSearch(true);
                      }}
                      onFocus={() => setShowUnitSearch(true)}
                      className="pl-10"
                    />
                    {showUnitSearch && filteredUnits.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredUnits.map((unit: any) => (
                          <div
                            key={unit.id}
                            onClick={() => handleUnitSelect(unit)}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <p className="font-medium">{unit.unitNumber}</p>
                            <p className="text-sm text-muted-foreground">{unit.propertyName}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedUnits.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedUnits.map((unit) => (
                        <Badge
                          key={unit.id}
                          variant="secondary"
                          className="flex items-center gap-2 px-3 py-1"
                        >
                          {unit.label}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleUnitRemove(unit.id)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attachments */}
              <Card>
                <CardHeader>
                  <CardTitle>Pièces jointes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Glissez vos fichiers ici ou cliquez pour parcourir
                    </p>
                    <Button type="button" variant="outline" size="sm">
                      Parcourir les fichiers
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {attachment.type === 'image' ? (
                              <ImageIcon className="h-5 w-5 text-blue-600" />
                            ) : (
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{attachment.name}</p>
                              <p className="text-xs text-muted-foreground">{attachment.size}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAttachment(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notification Options */}
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="email"
                      checked={form.watch('sendEmailNotification')}
                      onCheckedChange={(checked) =>
                        form.setValue('sendEmailNotification', checked as boolean)
                      }
                    />
                    <Label htmlFor="email" className="cursor-pointer">
                      Envoyer une notification par email
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sms"
                      checked={form.watch('sendSMSNotification')}
                      onCheckedChange={(checked) =>
                        form.setValue('sendSMSNotification', checked as boolean)
                      }
                    />
                    <Label htmlFor="sms" className="cursor-pointer">
                      Envoyer une notification SMS
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reminder"
                      checked={form.watch('createReminder')}
                      onCheckedChange={(checked) =>
                        form.setValue('createReminder', checked as boolean)
                      }
                    />
                    <Label htmlFor="reminder" className="cursor-pointer">
                      Créer un rappel 24h avant l'échéance
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Footer Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Link href="/tasks">
                  <Button type="button" variant="ghost">
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </Link>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer comme brouillon
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Créer la tâche
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Tips */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-base">Pour une meilleure organisation</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickTips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-2">
                    {tip.checked ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300 mt-0.5" />
                    )}
                    <p className="text-sm text-muted-foreground">{tip.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Tasks */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Tâches récentes</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentTasksLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : recentTasks && recentTasks.length > 0 ? (
                  recentTasks.map((task: any) => (
                    <div key={task.id} className="flex items-start gap-3">
                      <div
                        className={`h-2 w-2 rounded-full mt-2 ${
                          statusConfig[task.status as keyof typeof statusConfig]?.dotColor || 'bg-gray-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Assignée à {task.assignedUserName || 'Non assignée'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche récente</p>
                )}
              </CardContent>
            </Card>

            {/* Task Templates */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <CardTitle className="text-base">Modèles de tâches</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {taskTemplates.map((template, index) => (
                  <div
                    key={index}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">{template.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                  </div>
                ))}
                <Button variant="outline" className="w-full" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un modèle
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


