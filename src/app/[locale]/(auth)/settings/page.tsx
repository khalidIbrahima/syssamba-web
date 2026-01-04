'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, Users, CreditCard, Globe, Shield, Bell, UserCog, Edit, Building2 } from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { PageLoader } from '@/components/ui/page-loader';
import { usePageAccess } from '@/hooks/use-page-access';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { useAccess } from '@/hooks/use-access';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Schema for updating organization info
const updateOrganizationSchema = z.object({
  name: z.string().min(1, 'Le nom de l\'organisation est requis'),
  type: z.enum(['agency', 'sci', 'syndic', 'individual']),
  country: z.string().length(2, 'Le code pays doit contenir 2 caractères'),
});

type UpdateOrganizationFormValues = z.infer<typeof updateOrganizationSchema>;

interface OrganizationData {
  id: string;
  name: string | null;
  slug: string | null;
  type: string | null;
  country: string;
  customExtranetDomain: string | null;
  isConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

// Fetch organization info
async function getOrganizationInfo() {
  const response = await fetch('/api/organization/info', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch organization info');
  }
  return response.json();
}

export default function SettingsPage() {
  const { isLoading: isAccessLoading } = usePageAccess();
  const { plan, limits } = usePlan();
  const { canPerformAction, canAccessObject } = useAccess();

  // Organization info state
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null);
  const [isOrgLoading, setIsOrgLoading] = useState(true);
  const [isEditOrgDialogOpen, setIsEditOrgDialogOpen] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // Form for editing organization
  const {
    register: registerOrg,
    handleSubmit: handleSubmitOrg,
    formState: { errors: orgErrors, isSubmitting: isSubmittingOrg },
    reset: resetOrg,
    watch: watchOrg,
    setValue: setOrgValue,
  } = useForm<UpdateOrganizationFormValues>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      name: '',
      type: 'individual',
      country: 'SN',
    },
  });

  // Fetch organization info on component mount
  useEffect(() => {
    const fetchOrgInfo = async () => {
      try {
        const data = await getOrganizationInfo();
        setOrganizationData(data.organization);
        // Set form values
        setOrgValue('name', data.organization.name || '');
        setOrgValue('type', (data.organization.type || 'individual') as 'agency' | 'sci' | 'syndic' | 'individual');
        setOrgValue('country', data.organization.country || 'SN');
      } catch (error) {
        console.error('Failed to fetch organization info:', error);
        toast.error('Erreur lors du chargement des informations de l\'organisation');
      } finally {
        setIsOrgLoading(false);
      }
    };

    if (!isAccessLoading) {
      fetchOrgInfo();
    }
  }, [isAccessLoading, setOrgValue]);

  // Handle organization edit
  const handleEditOrganization = () => {
    if (organizationData) {
      setOrgValue('name', organizationData.name || '');
      setOrgValue('type', (organizationData.type || 'individual') as 'agency' | 'sci' | 'syndic' | 'individual');
      setOrgValue('country', organizationData.country || 'SN');
    }
    setIsEditOrgDialogOpen(true);
  };

  // Handle save organization
  const handleSaveOrganization = async (values: UpdateOrganizationFormValues) => {
    setIsSavingOrg(true);
    try {
      const response = await fetch('/api/organization/info', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update organization');
      }

      const result = await response.json();

      // Update local state
      setOrganizationData((prev: OrganizationData | null) => {
        if (!prev) return null;
        return {
          ...prev,
          name: result.organization.name,
          type: result.organization.type,
          country: result.organization.country,
        };
      });

      toast.success('Informations de l\'organisation mises à jour avec succès');
      setIsEditOrgDialogOpen(false);
      resetOrg();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour de l\'organisation');
    } finally {
      setIsSavingOrg(false);
    }
  };

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  return (
    <PermissionGate
      objectType="Organization"
      action="read"
      showDenied={true}
      deniedMessage="Vous n'avez pas la permission de voir les paramètres."
    >
    <div className="space-y-6 min-h-screen bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">Gestion des utilisateurs et configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Utilisateurs
            </CardTitle>
            <CardDescription>
              Gérez les accès et rôles ({limits.users - 1} places restantes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/settings/users">Gérer les utilisateurs</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Profils & Permissions
            </CardTitle>
            <CardDescription>
              Configurez les permissions et accès pour chaque profil
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/admin/profiles">Gérer les profils</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Abonnement
            </CardTitle>
            <CardDescription>
              Plan actuel: <Badge>{plan}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link href="/settings/subscription">Changer de plan</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Domaine extranet
            </CardTitle>
            <CardDescription>
              Personnalisez l'accès locataire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled={plan === 'freemium'}>
              Configurer domaine
            </Button>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Sécurité
            </CardTitle>
            <CardDescription>
              Mots de passe et authentification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Paramètres sécurité
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notifications
            </CardTitle>
            <CardDescription>
              Préférences de communication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Configurer notifications
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Intégrations
            </CardTitle>
            <CardDescription>
              APIs et services externes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Gérer intégrations
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informations de l'organisation
            </CardTitle>
            <CardDescription>Détails de votre compte SYS SAMBA</CardDescription>
          </div>
          {canAccessObject('Organization', 'edit') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditOrganization}
              disabled={isOrgLoading}
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isOrgLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                  <div className="h-6 bg-muted rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nom de l'organisation</label>
                <p className="text-foreground">{organizationData?.name || 'Non défini'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Type d'organisation</label>
                <p className="text-foreground">
                  {organizationData?.type === 'agency' && 'Agence'}
                  {organizationData?.type === 'sci' && 'SCI'}
                  {organizationData?.type === 'syndic' && 'Syndic'}
                  {organizationData?.type === 'individual' && 'Individuel'}
                  {!organizationData?.type && 'Non défini'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Pays</label>
                <p className="text-foreground">
                  {organizationData?.country === 'SN' && 'Sénégal'}
                  {organizationData?.country === 'FR' && 'France'}
                  {organizationData?.country === 'CI' && 'Côte d\'Ivoire'}
                  {organizationData?.country === 'ML' && 'Mali'}
                  {organizationData?.country || 'Non défini'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Plan actuel</label>
                <p className="text-foreground capitalize">{plan}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Limite lots</label>
                <p className="text-foreground">{limits.lots === -1 ? 'Illimité' : limits.lots}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Utilisateurs actifs</label>
                <p className="text-foreground">1 / {limits.users}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditOrgDialogOpen} onOpenChange={setIsEditOrgDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier les informations de l'organisation</DialogTitle>
            <DialogDescription>
              Modifiez les informations de base de votre organisation. Ces modifications seront visibles par tous les membres.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitOrg(handleSaveOrganization)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Nom de l'organisation *</Label>
              <Input
                id="orgName"
                placeholder="Ex: Ma Société Immobilière"
                {...registerOrg('name')}
              />
              {orgErrors.name && (
                <p className="text-sm text-red-600">{orgErrors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgType">Type d'organisation *</Label>
              <Select
                value={watchOrg?.('type') || 'individual'}
                onValueChange={(value) => {
                  setOrgValue('type', value as any);
                }}
              >
                <SelectTrigger id="orgType">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individuel</SelectItem>
                  <SelectItem value="agency">Agence</SelectItem>
                  <SelectItem value="sci">SCI</SelectItem>
                  <SelectItem value="syndic">Syndic</SelectItem>
                </SelectContent>
              </Select>
              {orgErrors.type && (
                <p className="text-sm text-red-600">{orgErrors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgCountry">Pays *</Label>
              <Select
                value={watchOrg?.('country') || 'SN'}
                onValueChange={(value) => {
                  setOrgValue('country', value);
                }}
              >
                <SelectTrigger id="orgCountry">
                  <SelectValue placeholder="Sélectionner un pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SN">Sénégal</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                  <SelectItem value="CI">Côte d'Ivoire</SelectItem>
                  <SelectItem value="ML">Mali</SelectItem>
                </SelectContent>
              </Select>
              {orgErrors.country && (
                <p className="text-sm text-red-600">{orgErrors.country.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOrgDialogOpen(false);
                  resetOrg();
                }}
                disabled={isSavingOrg || isSubmittingOrg}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSavingOrg || isSubmittingOrg}>
                {isSavingOrg || isSubmittingOrg ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </PermissionGate>
  );
}
