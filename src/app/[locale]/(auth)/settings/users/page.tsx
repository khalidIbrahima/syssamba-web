'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Users,
  Plus,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Shield,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  Crown,
  Building2,
  MessageSquare,
  TrendingUp,
  Clock,
  UserPlus,
  ArrowUpRight,
  Info,
  Sparkles,
  BarChart3,
  Activity,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';
import { usePageAccess } from '@/hooks/use-page-access';
import { FeatureGate } from '@/components/features/FeatureGate';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

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

// Fetch stats from API
async function getUserStats() {
  const response = await fetch('/api/organization/users/stats', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  return response.json();
}

// Fetch profiles from API
async function getProfiles() {
  const response = await fetch('/api/profiles', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch profiles');
  }
  return response.json();
}

// Fetch activities from API
async function getUserActivities() {
  const response = await fetch('/api/organization/users/activities', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch activities');
  }
  return response.json();
}

// Fetch custom roles from API
async function getCustomRoles() {
  const response = await fetch('/api/organization/users/roles', {
    credentials: 'include',
  });
  if (!response.ok) {
    // If 403, user doesn't have permission, return empty array
    if (response.status === 403) {
      return { roles: [] };
    }
    throw new Error('Failed to fetch custom roles');
  }
  return response.json();
}

// Fetch plan features from API
async function getPlanFeatures(planName?: string) {
  const url = planName 
    ? `/api/organization/users/plan-features?plan=${planName}&withStatus=true`
    : '/api/organization/users/plan-features';
  const response = await fetch(url, {
    credentials: 'include',
  });
  if (!response.ok) {
    // If 403, user doesn't have permission, return empty array
    if (response.status === 403) {
      return { features: [] };
    }
    throw new Error('Failed to fetch plan features');
  }
  return response.json();
}

// Create user schema
const createUserSchema = z.object({
  email: z.string().email('Email invalide').optional(),
  phone: z.string().optional(),
  firstName: z.string().min(1, 'Le prénom est requis').optional(),
  lastName: z.string().min(1, 'Le nom est requis').optional(),
  role: z.enum(['owner', 'admin', 'accountant', 'agent', 'viewer']),
  profileId: z.string().uuid('Profil invalide').optional(),
  invitationMethod: z.enum(['email', 'sms', 'both']),
}).refine((data) => data.email || data.phone, {
  message: 'Email ou téléphone requis',
  path: ['email'],
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

// Create role schema
const createRoleSchema = z.object({
  name: z.string().min(1, 'Le nom du rôle est requis').max(100),
  slug: z.string().min(1, 'Le slug est requis').max(50).regex(/^[a-z0-9_]+$/, 'Le slug doit contenir uniquement des lettres minuscules, chiffres et underscores'),
  description: z.string().optional(),
  color: z.string(),
});

type CreateRoleFormValues = z.infer<typeof createRoleSchema>;

export default function UsersPage() {
  const { canPerformAction, canAccessObject, isLoading: isAccessLoading } = usePageAccess();
  const { limits, plan } = usePlan();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isFeaturesDialogOpen, setIsFeaturesDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editedFeatures, setEditedFeatures] = useState<Record<string, boolean>>({});
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const { data, isLoading, refetch } = useDataQuery(
    ['organization-users'],
    getUsers
  );

  const { data: statsData } = useDataQuery(
    ['user-stats'],
    getUserStats
  );

  const { data: activitiesData } = useDataQuery(
    ['user-activities'],
    getUserActivities
  );

  const { data: customRolesData, refetch: refetchCustomRoles } = useDataQuery(
    ['custom-roles'],
    getCustomRoles
  );

  const { data: planFeaturesData, refetch: refetchPlanFeatures } = useDataQuery(
    ['plan-features', plan],
    () => getPlanFeatures(plan)
  );

  const { data: profilesData, isLoading: profilesLoading, refetch: refetchProfiles } = useDataQuery(
    ['profiles'],
    getProfiles
  );

  // Form for editing user
  const updateUserSchema = z.object({
    firstName: z.string().min(1, 'Le prénom est requis'),
    lastName: z.string().min(1, 'Le nom est requis'),
    email: z.string().email('Email invalide').optional(),
    phone: z.string().optional(),
    profileId: z.string().uuid('Profil invalide'),
    isActive: z.boolean(),
  });

  type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: 'viewer',
      invitationMethod: 'email',
      profileId: undefined,
    },
  });

  const {
    register: registerRole,
    handleSubmit: handleSubmitRole,
    formState: { errors: roleErrors, isSubmitting: isSubmittingRole },
    reset: resetRole,
    watch: watchRole,
  } = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      color: 'bg-gray-100 text-foreground',
    },
  });

  const {
    register: registerUser,
    handleSubmit: handleSubmitUser,
    formState: { errors: userErrors, isSubmitting: isSubmittingUserEdit },
    reset: resetUser,
    watch: watchUser,
    setValue: setUserValue,
  } = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      profileId: '',
      isActive: true,
    },
  });

  // Update form when editingUser changes
  useEffect(() => {
    if (editingUser) {
      setUserValue('firstName', editingUser.firstName || '');
      setUserValue('lastName', editingUser.lastName || '');
      setUserValue('email', editingUser.email || '');
      setUserValue('phone', editingUser.phone || '');
      setUserValue('profileId', editingUser.profileId || '');
      setUserValue('isActive', editingUser.isActive ?? true);
    }
  }, [editingUser, setUserValue]);

  const users = data?.users || [];
  const invitations = data?.invitations || [];
  const totalCount = data?.totalCount || 0;
  const stats = statsData?.stats || { 
    activeUsers: 0, 
    extranetTenants: 0, 
    roleCounts: {},
    monthlyCommissions: 0,
    commissionChange: 0,
    processedMessages: 0,
    avgResponseTimeHours: 0,
  };
  const planInfo = statsData?.plan || { usersLimit: 15, extranetTenantsLimit: 100, customDomain: null };
  const activities = activitiesData?.activities || [];
  const customRoles = customRolesData?.roles || [];
  const profiles = profilesData || [];

  // Get plan features
  const planFeatures = planFeaturesData?.features || [];

  // Wait for access and data to load
  if (isAccessLoading || isLoading || profilesLoading) {
    return <PageLoader message="Chargement..." />;
  }
  
  // Group features by category
  const featuresByCategory = planFeatures.reduce((acc: any, feature: any) => {
    const category = feature.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(feature);
    return acc;
  }, {});

  const handleEditFeatures = () => {
    // Initialize edited features with current plan features
    const initialFeatures: Record<string, boolean> = {};
    planFeatures.forEach((feature: any) => {
      initialFeatures[feature.key] = feature.isEnabled || false;
    });
    setEditedFeatures(initialFeatures);
    setIsFeaturesDialogOpen(true);
  };

  const handleSaveFeatures = async () => {
    setIsSavingFeatures(true);
    try {
      const response = await fetch('/api/organization/users/plan-features', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          planName: plan,
          features: editedFeatures,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update plan features');
      }

      toast.success('Fonctionnalités mises à jour avec succès !');
      setIsFeaturesDialogOpen(false);
      refetchPlanFeatures();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour des fonctionnalités');
    } finally {
      setIsSavingFeatures(false);
    }
  };

  const handleFeatureChange = (featureKey: string, checked: boolean) => {
    setEditedFeatures(prev => ({
      ...prev,
      [featureKey]: checked,
    }));
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setIsEditUserDialogOpen(true);
  };

  const handleSaveUser = async (values: UpdateUserFormValues) => {
    if (!editingUser) return;

    setIsSavingUser(true);
    try {
      const response = await fetch(`/api/organization/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          profileId: values.profileId,
          isActive: values.isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      toast.success('Utilisateur mis à jour avec succès !');
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
      resetUser();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour de l\'utilisateur');
    } finally {
      setIsSavingUser(false);
    }
  };

  const invitationMethod = watch('invitationMethod');
  const roleName = watchRole('name');

  const onSubmit = async (values: CreateUserFormValues) => {
    try {
      // Check limit before submitting
      if (planInfo.usersLimit !== null && planInfo.usersLimit !== -1 && stats.activeUsers >= planInfo.usersLimit) {
        toast.error(
          `Limite d'utilisateurs atteinte. Votre plan permet ${planInfo.usersLimit} utilisateur${planInfo.usersLimit > 1 ? 's' : ''}. Veuillez mettre à niveau votre plan pour inviter plus d'utilisateurs.`,
          { duration: 8000 }
        );
        return;
      }

      const response = await fetch('/api/organization/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle limit reached error specifically
        if (error.limitReached) {
          toast.error(
            error.error || `Limite d'utilisateurs atteinte (${error.currentCount}/${error.limit}). Veuillez mettre à niveau votre plan.`,
            { duration: 8000 }
          );
          // Refresh stats to update the UI
          refetch();
          return;
        }
        
        throw new Error(error.error || 'Failed to create invitation');
      }

      const result = await response.json();
      
      toast.success(
        `Invitation créée avec succès ! Lien: ${result.invitationUrl}`,
        { duration: 10000 }
      );
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(result.invitationUrl);
        toast.info('Lien copié dans le presse-papiers');
      }
      
      reset();
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la création de l\'invitation');
    }
  };

  const onSubmitRole = async (values: CreateRoleFormValues) => {
    try {
      // Generate slug from name if not provided
      const slug = values.slug || values.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

      const response = await fetch('/api/organization/users/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...values,
          slug,
          permissions: {}, // Empty permissions by default, can be configured later
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create role');
      }

      toast.success('Rôle créé avec succès !');
      resetRole();
      setIsRoleDialogOpen(false);
      refetch(); // Refresh stats to show new role
      refetchCustomRoles(); // Refresh custom roles list
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la création du rôle');
    }
  };

  const formatLastActivity = (dateString: string | null) => {
    if (!dateString) return 'Jamais connecté';
    try {
      const date = parseISO(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Connecté maintenant';
      if (diffInMinutes < 60) return `Connecté il y a ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `Connecté il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `Connecté il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
      
      return formatDistanceToNow(date, { addSuffix: true, locale: fr });
    } catch {
      return 'Date invalide';
    }
  };

  const getProfileBadge = (profileId: string | null | undefined) => {
    if (!profileId || !profiles || profiles.length === 0) {
      return <Badge variant="outline">Aucun profil</Badge>;
    }
    const profile = profiles.find((p: any) => p.id === profileId);
    if (!profile) {
      return <Badge variant="outline">Profil inconnu</Badge>;
    }
    return (
      <Badge 
        variant={profile.isSystemProfile ? "default" : "outline"}
        className={profile.isSystemProfile ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700" : ""}
      >
        {profile.name}
        {profile.isGlobal && ' (Global)'}
      </Badge>
    );
  };

  // Filter users
  const filteredUsers = users.filter((user: any) => {
    const matchesSearch = !searchQuery || 
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProfile = roleFilter === 'all' || user.profileId === roleFilter;
    return matchesSearch && matchesProfile;
  });

  // Paginate users
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  // Calculate percentages
  const usersPercentage = planInfo.usersLimit 
    ? (stats.activeUsers / planInfo.usersLimit) * 100 
    : 0;
  const tenantsPercentage = planInfo.extranetTenantsLimit 
    ? (stats.extranetTenants / planInfo.extranetTenantsLimit) * 100 
    : 0;

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader />;
  }

  // Check if user has permission to read User objects
  if (!canAccessObject('User', 'read')) {
    return <AccessDenied message="Vous n'avez pas la permission d'accéder à la gestion des utilisateurs." />;
  }

  return (
    <FeatureGate
      feature="multi_user"
      showUpgrade={true}
    >
      <div className="space-y-6 min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion Utilisateurs & Rôles</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les accès et permissions selon votre plan {plan.charAt(0).toUpperCase() + plan.slice(1)}
          </p>
        </div>
        {canAccessObject('User', 'create') && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
                disabled={
                  planInfo.usersLimit !== null && 
                  planInfo.usersLimit !== -1 && 
                  stats.activeUsers >= planInfo.usersLimit
                }
                title={
                  planInfo.usersLimit !== null && 
                  planInfo.usersLimit !== -1 && 
                  stats.activeUsers >= planInfo.usersLimit
                    ? `Limite d'utilisateurs atteinte (${stats.activeUsers}/${planInfo.usersLimit}). Veuillez mettre à niveau votre plan.`
                    : undefined
                }
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Inviter utilisateur
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Inviter un nouvel utilisateur</DialogTitle>
              <DialogDescription>
                Envoyez une invitation à un nouvel utilisateur pour rejoindre votre organisation. L'invitation peut être envoyée par email, SMS ou les deux.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invitationMethod">Méthode d'envoi *</Label>
                <Select
                  defaultValue="email"
                  onValueChange={(value) => {
                    register('invitationMethod').onChange({ target: { value } });
                  }}
                >
                  <SelectTrigger id="invitationMethod">
                    <SelectValue placeholder="Sélectionner une méthode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email uniquement</SelectItem>
                    <SelectItem value="sms">SMS uniquement</SelectItem>
                    <SelectItem value="both">Email et SMS</SelectItem>
                  </SelectContent>
                </Select>
                {errors.invitationMethod && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.invitationMethod.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email {(invitationMethod === 'email' || invitationMethod === 'both') ? '*' : ''}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="utilisateur@example.com"
                  {...register('email')}
                  disabled={invitationMethod === 'sms'}
                />
                {errors.email && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Téléphone {(invitationMethod === 'sms' || invitationMethod === 'both') ? '*' : ''}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+221 77 123 45 67"
                  {...register('phone')}
                  disabled={invitationMethod === 'email'}
                />
                {errors.phone && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.phone.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {invitationMethod === 'email' && 'Email requis pour cette méthode'}
                  {invitationMethod === 'sms' && 'Téléphone requis pour cette méthode'}
                  {invitationMethod === 'both' && 'Email et téléphone requis pour cette méthode'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    placeholder="Jean"
                    {...register('firstName')}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-600 dark:text-red-400">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    placeholder="Dupont"
                    {...register('lastName')}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-600 dark:text-red-400">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profileId">Profil *</Label>
                <Select
                  value={watch('profileId') || ''}
                  onValueChange={(value) => {
                    setValue('profileId', value, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger id="profileId">
                    <SelectValue placeholder="Sélectionner un profil" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles && profiles.length > 0 ? (
                      profiles.map((profile: any) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                          {profile.isSystemProfile && ' (Système)'}
                          {profile.isGlobal && ' (Global)'}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__none__" disabled>Aucun profil disponible</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  {...register('profileId')}
                />
                {errors.profileId && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.profileId.message}</p>
                )}
                {profilesLoading && (
                  <p className="text-xs text-muted-foreground">Chargement des profils...</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select
                  defaultValue="viewer"
                  onValueChange={(value) => {
                    register('role').onChange({ target: { value } });
                  }}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="agent">Gestionnaire</SelectItem>
                    <SelectItem value="accountant">Agent</SelectItem>
                    <SelectItem value="viewer">Comptable</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.role.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Création...' : 'Envoyer l\'invitation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Plan Info Card - Enhanced */}
      <Card className="bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50 dark:from-blue-950 dark:via-blue-900 dark:to-indigo-950 border-blue-200 dark:border-blue-800 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <Crown className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-foreground text-lg">Plan {plan.charAt(0).toUpperCase() + plan.slice(1)}</h3>
                  <Badge variant="outline" className="text-xs">Actif</Badge>
                </div>
                <div className="flex items-center gap-6 mt-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {stats.activeUsers}/{planInfo.usersLimit || '∞'} utilisateurs
                    </span>
                    {planInfo.usersLimit && (
                      <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                          style={{ width: `${Math.min((stats.activeUsers / planInfo.usersLimit) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {stats.extranetTenants}/{planInfo.extranetTenantsLimit || '∞'} locataires
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {planInfo.customDomain && (
                <div className="px-3 py-1.5 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-medium text-muted-foreground">{planInfo.customDomain}</span>
                  </div>
                </div>
              )}
              {canAccessObject('Organization', 'edit') && (
                <Button 
                  variant="outline" 
                  className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm border-blue-200 dark:border-blue-800 text-foreground"
                  onClick={handleEditFeatures}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Gérer fonctionnalités
                </Button>
              )}
              <Button variant="outline" className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm border-blue-200 dark:border-blue-800 text-foreground">
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Upgrader
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Active Users */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Utilisateurs actifs</CardTitle>
                  <CardDescription className="mt-1">
                    {stats.activeUsers} utilisateur{stats.activeUsers > 1 ? 's' : ''} sur {planInfo.usersLimit || '∞'} autorisé{planInfo.usersLimit !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter */}
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={(value) => {
                  setRoleFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tous les rôles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les profils</SelectItem>
                    {profiles.map((profile: any) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                        {profile.isGlobal && ' (Global)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Users List */}
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : paginatedUsers.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {paginatedUsers.map((user: any) => (
                      <div
                        key={user.id}
                        className="group flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md bg-white dark:bg-gray-800 transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="relative">
                            <Avatar className="h-12 w-12 ring-2 ring-gray-100 dark:ring-gray-700 group-hover:ring-blue-200 dark:group-hover:ring-blue-700 transition-all">
                              <AvatarImage src={user.avatarUrl} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                                {user.firstName?.[0] || ''}{user.lastName?.[0] || ''}
                              </AvatarFallback>
                            </Avatar>
                            {user.isActive && (
                              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <p className="font-semibold text-foreground">
                                {user.firstName} {user.lastName}
                              </p>
                              {getProfileBadge(user.profileId)}
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              {user.email && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Mail className="h-3.5 w-3.5" />
                                  <span className="truncate">{user.email}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{formatLastActivity(user.lastActivity || user.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {user.isActive ? (
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700">
                              <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400 mr-1.5 animate-pulse"></div>
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 dark:bg-gray-800 text-muted-foreground border-gray-200 dark:border-gray-700">
                              <div className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 mr-1.5"></div>
                              Inactif
                            </Badge>
                          )}
                          {canAccessObject('User', 'edit') && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Affichage de {(currentPage - 1) * pageSize + 1} à {Math.min(currentPage * pageSize, filteredUsers.length)} sur {filteredUsers.length} utilisateurs
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Précédent
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Suivant
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Aucun utilisateur trouvé
                  </h3>
                  <p className="text-muted-foreground">
                    {searchQuery || roleFilter !== 'all' 
                      ? 'Aucun utilisateur ne correspond aux critères de recherche'
                      : 'Commencez par ajouter votre premier utilisateur'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* KPIs - Enhanced */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-600 hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">Locataires avec redevance</p>
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground mb-2">
                  {stats.extranetTenants}
                  <span className="text-lg font-normal text-muted-foreground"> / {planInfo.extranetTenantsLimit || '∞'}</span>
                </p>
                <Progress value={tenantsPercentage} className="h-2.5" />
                <p className="text-xs text-muted-foreground mt-2">
                  {tenantsPercentage.toFixed(0)}% de la limite utilisée
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 dark:border-l-green-600 hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">Commissions ce mois</p>
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground mb-2">
                  {stats.monthlyCommissions?.toLocaleString('fr-FR') || '0'}
                </p>
                {stats.commissionChange !== undefined && stats.commissionChange !== 0 && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className={`h-3 w-3 ${stats.commissionChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                    <p className={`text-xs font-medium ${stats.commissionChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {stats.commissionChange >= 0 ? '+' : ''}{stats.commissionChange.toFixed(0)}% vs mois dernier
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 dark:border-l-purple-600 hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">Messages traités</p>
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground mb-2">
                  {stats.processedMessages || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Temps moyen: {stats.avgResponseTimeHours > 0 ? `${stats.avgResponseTimeHours.toFixed(1)}h` : 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity: any, index: number) => {
                    const activityColor = activity.type === 'user_joined' ? 'bg-green-500' :
                                         activity.type === 'user_invited' ? 'bg-blue-500' :
                                         'bg-orange-500';
                    return (
                      <div 
                        key={activity.id || index} 
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                      >
                        <div className="relative flex-shrink-0">
                          <div className={`absolute top-0 left-0 h-3 w-3 rounded-full ${activityColor} ring-2 ring-white dark:ring-gray-800`}></div>
                          <Avatar className="h-9 w-9 ring-2 ring-gray-100 dark:ring-gray-700 group-hover:ring-gray-200 dark:group-hover:ring-gray-600 transition-all">
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white text-xs font-semibold">
                              {activity.user?.firstName?.[0] || ''}{activity.user?.lastName?.[0] || ''}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium leading-snug">
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true, locale: fr })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucune activité récente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Roles & Permissions */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Rôles & Permissions
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Gestion des accès et permissions
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto px-6 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
              {/* Custom Roles */}
              {customRoles.length > 0 && (
                <>
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">Rôles personnalisés</h4>
                  </div>
                  {customRoles.map((customRole: any) => {
                    // Count users with this custom role (if stored in a different way)
                    // For now, we'll show 0 as custom roles might not be directly assigned yet
                    const count = 0;
                    return (
                      <div
                        key={customRole.id}
                        className="group p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-sm bg-white dark:bg-gray-800 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={`${customRole.color || 'bg-gray-100 text-foreground'} text-xs font-semibold px-2.5 py-1`}>
                            {customRole.name}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">
                              {count}
                            </span>
                          </div>
                        </div>
                        {customRole.description && (
                          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{customRole.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-xs px-2.5 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md font-medium">
                            Personnalisé
                          </span>
                          {customRole.slug && (
                            <span className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-muted-foreground rounded-md font-medium">
                              {customRole.slug}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              </div>
              {/* Create Role Button - Fixed at bottom */}
              <div className="px-6 pb-6 pt-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Créer nouveau rôle
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Créer un nouveau rôle</DialogTitle>
                    <DialogDescription>
                      Créez un rôle personnalisé avec des permissions spécifiques pour votre organisation.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitRole(onSubmitRole)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="roleName">Nom du rôle *</Label>
                      <Input
                        id="roleName"
                        placeholder="Ex: Gestionnaire Senior"
                        {...registerRole('name')}
                      />
                      {roleErrors.name && (
                        <p className="text-sm text-red-600 dark:text-red-400">{roleErrors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roleSlug">Slug (identifiant unique) *</Label>
                      <Input
                        id="roleSlug"
                        placeholder="Ex: senior_manager"
                        {...registerRole('slug')}
                      />
                      <p className="text-xs text-muted-foreground">
                        Utilisez uniquement des lettres minuscules, chiffres et underscores
                      </p>
                      {roleErrors.slug && (
                        <p className="text-sm text-red-600 dark:text-red-400">{roleErrors.slug.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roleDescription">Description</Label>
                      <Input
                        id="roleDescription"
                        placeholder="Description du rôle..."
                        {...registerRole('description')}
                      />
                      {roleErrors.description && (
                        <p className="text-sm text-red-600 dark:text-red-400">{roleErrors.description.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roleColor">Couleur du badge</Label>
                      <Select
                        defaultValue="bg-gray-100 text-foreground"
                        onValueChange={(value) => {
                          registerRole('color').onChange({ target: { value } });
                        }}
                      >
                        <SelectTrigger id="roleColor">
                          <SelectValue placeholder="Sélectionner une couleur" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bg-gray-100 text-foreground">Gris</SelectItem>
                          <SelectItem value="bg-blue-100 text-blue-800">Bleu</SelectItem>
                          <SelectItem value="bg-green-100 text-green-800">Vert</SelectItem>
                          <SelectItem value="bg-purple-100 text-purple-800">Violet</SelectItem>
                          <SelectItem value="bg-red-100 text-red-800">Rouge</SelectItem>
                          <SelectItem value="bg-yellow-100 text-yellow-800">Jaune</SelectItem>
                        </SelectContent>
                      </Select>
                      {roleErrors.color && (
                        <p className="text-sm text-red-600 dark:text-red-400">{roleErrors.color.message}</p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsRoleDialogOpen(false)}
                      >
                        Annuler
                      </Button>
                      <Button type="submit" disabled={isSubmittingRole}>
                        {isSubmittingRole ? 'Création...' : 'Créer le rôle'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Plan Features Dialog */}
      <Dialog open={isFeaturesDialogOpen} onOpenChange={setIsFeaturesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Gérer les fonctionnalités - Plan {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </DialogTitle>
            <DialogDescription>
              Activez ou désactivez les fonctionnalités disponibles pour ce plan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {Object.entries(featuresByCategory).map(([category, features]: [string, any]) => {
              const categoryLabels: Record<string, string> = {
                core: 'Fonctionnalités principales',
                tenants: 'Gestion des locataires',
                leases: 'Gestion des contrats',
                payments: 'Paiements',
                tasks: 'Tâches',
                notifications: 'Notifications',
                extranet: 'Extranet',
                accounting: 'Comptabilité',
                advanced: 'Fonctionnalités avancées',
                reports: 'Rapports',
                support: 'Support',
                other: 'Autres',
              };

              return (
                <div key={category} className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    {categoryLabels[category] || category}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {features.map((feature: any) => (
                      <div 
                        key={feature.key} 
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex-1">
                          <Label htmlFor={`feature-${feature.key}`} className="cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {feature.name}
                              </span>
                            </div>
                            {feature.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {feature.description}
                              </p>
                            )}
                          </Label>
                        </div>
                        <Checkbox
                          id={`feature-${feature.key}`}
                          checked={editedFeatures[feature.key] || false}
                          onCheckedChange={(checked) => handleFeatureChange(feature.key, checked === true)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsFeaturesDialogOpen(false)}
              disabled={isSavingFeatures}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveFeatures}
              disabled={isSavingFeatures}
            >
              {isSavingFeatures ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'utilisateur. Les modifications seront appliquées immédiatement.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitUser(handleSaveUser)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">Prénom *</Label>
                <Input
                  id="editFirstName"
                  placeholder="Jean"
                  {...registerUser('firstName')}
                />
                {userErrors.firstName && (
                  <p className="text-sm text-red-600 dark:text-red-400">{userErrors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Nom *</Label>
                <Input
                  id="editLastName"
                  placeholder="Dupont"
                  {...registerUser('lastName')}
                />
                {userErrors.lastName && (
                  <p className="text-sm text-red-600 dark:text-red-400">{userErrors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  placeholder="jean.dupont@example.com"
                  {...registerUser('email')}
                />
                {userErrors.email && (
                  <p className="text-sm text-red-600 dark:text-red-400">{userErrors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPhone">Téléphone</Label>
                <Input
                  id="editPhone"
                  type="tel"
                  placeholder="+221 77 123 45 67"
                  {...registerUser('phone')}
                />
                {userErrors.phone && (
                  <p className="text-sm text-red-600 dark:text-red-400">{userErrors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editProfile">Profil *</Label>
                <Select
                  value={watchUser('profileId')}
                  onValueChange={(value) => {
                    setUserValue('profileId', value);
                  }}
                  disabled={profilesLoading}
                >
                  <SelectTrigger id="editProfile">
                    <SelectValue placeholder="Sélectionner un profil" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile: any) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                        {!profile.organizationId && ' (Système)'}
                        {profile.isSystemProfile && profile.organizationId && ' (Système)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {userErrors.profileId && (
                  <p className="text-sm text-red-600 dark:text-red-400">{userErrors.profileId.message}</p>
                )}
                {profilesLoading && (
                  <p className="text-xs text-muted-foreground">Chargement des profils...</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="editIsActive">Statut</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="editIsActive"
                    checked={watchUser('isActive')}
                    onCheckedChange={(checked) => {
                      setUserValue('isActive', checked === true);
                    }}
                  />
                  <Label htmlFor="editIsActive" className="text-sm font-normal cursor-pointer">
                    Utilisateur actif
                  </Label>
                </div>
                {userErrors.isActive && (
                  <p className="text-sm text-red-600 dark:text-red-400">{userErrors.isActive.message}</p>
                )}
              </div>
            </div>

            {editingUser && editingUser.id === data?.currentUser?.id && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Vous ne pouvez pas modifier votre propre profil.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditUserDialogOpen(false);
                  setEditingUser(null);
                  resetUser();
                }}
                disabled={isSavingUser || isSubmittingUserEdit}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSavingUser || isSubmittingUserEdit}>
                {isSavingUser || isSubmittingUserEdit ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </FeatureGate>
  );
}
