'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDataQuery } from '@/hooks/use-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Building2,
  Search,
  Edit,
  Eye,
  Loader2,
  Settings,
  Users,
  Home,
  CreditCard,
  LogOut,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

interface Organization {
  id: string;
  name: string | null;
  slug: string | null;
  type: string | null;
  country: string;
  plan: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  subscriptionStatus: string | null;
  extranetTenantsCount: number;
  customExtranetDomain: string | null;
  stripeCustomerId: string | null;
  isConfigured: boolean;
  userCount: number;
  unitCount: number;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationsResponse {
  organizations: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Fetch organizations
async function getOrganizations(params: {
  search?: string;
  plan?: string;
  page?: number;
}): Promise<OrganizationsResponse> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.plan) searchParams.set('plan', params.plan);
  if (params.page) searchParams.set('page', params.page.toString());

  const response = await fetch(`/api/admin/organizations?${searchParams.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Vous devez être super-admin pour accéder à cette page');
    }
    throw new Error('Erreur lors du chargement des organisations');
  }

  return response.json();
}

// Fetch all plans
async function getPlans() {
  try {
    const response = await fetch('/api/plans', {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('[getPlans] API error:', response.status, response.statusText);
      return { plans: [], count: 0 };
    }

    const data = await response.json();
    console.log('[getPlans] Received data:', data);
    return data;
  } catch (error) {
    console.error('[getPlans] Fetch error:', error);
    return { plans: [], count: 0 };
  }
}

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState<boolean | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/sign-in');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Check if user is super-admin or global admin and get selected organization (only on client)
  useEffect(() => {
    setIsMounted(true);
    
    async function checkAdmin() {
      try {
        const response = await fetch('/api/admin/check-super-admin', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setIsSuperAdmin(data.isSuperAdmin);
          setIsGlobalAdmin(data.isGlobalAdmin);
          if (!data.isSuperAdmin && !data.isGlobalAdmin) {
            router.push('/dashboard');
            toast.error('Accès refusé : vous devez être super-admin ou administrateur global');
            return;
          }
          
          // Get selected organization from localStorage (set by select-organization page)
          const selectedOrgId = localStorage.getItem('superAdminSelectedOrgId');
          if (selectedOrgId) {
            setCurrentOrgId(selectedOrgId);
          } else {
            // If no organization selected, redirect to selection page
            router.push('/admin/select-organization');
          }
        } else {
          setIsSuperAdmin(false);
          setIsGlobalAdmin(false);
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsSuperAdmin(false);
        setIsGlobalAdmin(false);
        router.push('/dashboard');
      }
    }
    checkAdmin();
  }, [router]);

  const { data, isLoading, error, refetch } = useDataQuery(
    ['admin-organizations', search, planFilter, page.toString()],
    () => getOrganizations({ search, plan: planFilter || undefined, page })
  );

  const { data: plansData, isLoading: isLoadingPlans, error: plansError } = useDataQuery(['plans'], getPlans);

  const organizations = data?.organizations || [];
  const pagination = data?.pagination;

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted || isSuperAdmin === null || isGlobalAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isSuperAdmin === false && isGlobalAdmin === false) {
    return null; // Will redirect
  }

  const handleViewDetails = (org: Organization) => {
    setSelectedOrg(org);
    setIsDetailsDialogOpen(true);
  };

  const handleEdit = (org: Organization) => {
    setSelectedOrg(org);
    setIsEditDialogOpen(true);
  };

  const handlePlanChange = async (orgId: string, planId: string) => {
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}/subscription`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la modification du plan');
      }

      toast.success('Plan modifié avec succès');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification du plan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            Administration - Organisations
          </h1>
          <p className="text-gray-600 mt-1">
            Gérez toutes les organisations, leurs plans et autorisations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem('superAdminSelectedOrgId');
              router.push('/admin/select-organization');
            }}
          >
            Changer d'organisation
          </Button>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher une organisation..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={planFilter || "all"} onValueChange={(value) => setPlanFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isLoadingPlans ? "Chargement..." : "Filtrer par plan"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les plans</SelectItem>
                {isLoadingPlans ? (
                  <SelectItem value="loading" disabled>
                    Chargement des plans...
                  </SelectItem>
                ) : plansError ? (
                  <SelectItem value="error" disabled>
                    Erreur de chargement
                  </SelectItem>
                ) : plansData?.plans && plansData.plans.length > 0 ? (
                  plansData.plans.map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.displayName}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="empty" disabled>
                    Aucun plan disponible
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Organisations ({pagination?.total || 0})</CardTitle>
          <CardDescription>
            Liste de toutes les organisations de la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              Erreur lors du chargement des organisations
            </div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucune organisation trouvée
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organisation</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Utilisateurs</TableHead>
                      <TableHead>Lots</TableHead>
                      <TableHead>Créée le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{org.name || 'Sans nom'}</div>
                            <div className="text-sm text-gray-500">{org.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {org.plan ? (
                            <Badge variant="outline">{org.plan.displayName}</Badge>
                          ) : (
                            <span className="text-gray-400">Aucun plan</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {org.subscriptionStatus ? (
                            <Badge
                              variant={
                                org.subscriptionStatus === 'active'
                                  ? 'default'
                                  : org.subscriptionStatus === 'trialing'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {org.subscriptionStatus}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Inactif</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            {org.userCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Home className="h-4 w-4 text-gray-400" />
                            {org.unitCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(org.createdAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(org)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(org)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    Page {pagination.page} sur {pagination.totalPages} ({pagination.total}{' '}
                    organisations)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page === 1}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de l'organisation</DialogTitle>
            <DialogDescription>
              Informations complètes sur l'organisation
            </DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nom</Label>
                  <p className="text-sm font-medium">{selectedOrg.name || 'N/A'}</p>
                </div>
                <div>
                  <Label>Slug</Label>
                  <p className="text-sm font-medium">{selectedOrg.slug || 'N/A'}</p>
                </div>
                <div>
                  <Label>Type</Label>
                  <p className="text-sm font-medium">{selectedOrg.type || 'N/A'}</p>
                </div>
                <div>
                  <Label>Pays</Label>
                  <p className="text-sm font-medium">{selectedOrg.country}</p>
                </div>
                <div>
                  <Label>Plan</Label>
                  <p className="text-sm font-medium">
                    {selectedOrg.plan?.displayName || 'Aucun plan'}
                  </p>
                </div>
                <div>
                  <Label>Statut abonnement</Label>
                  <p className="text-sm font-medium">
                    {selectedOrg.subscriptionStatus || 'Inactif'}
                  </p>
                </div>
                <div>
                  <Label>Utilisateurs</Label>
                  <p className="text-sm font-medium">{selectedOrg.userCount}</p>
                </div>
                <div>
                  <Label>Lots</Label>
                  <p className="text-sm font-medium">{selectedOrg.unitCount}</p>
                </div>
                <div>
                  <Label>Locataires Extranet</Label>
                  <p className="text-sm font-medium">{selectedOrg.extranetTenantsCount}</p>
                </div>
                <div>
                  <Label>Domaine personnalisé</Label>
                  <p className="text-sm font-medium">
                    {selectedOrg.customExtranetDomain || 'N/A'}
                  </p>
                </div>
                {isSuperAdmin && (
                  <div>
                    <Label>Stripe Customer ID</Label>
                    <p className="text-sm font-medium">
                      {selectedOrg.stripeCustomerId || 'N/A'}
                    </p>
                  </div>
                )}
                <div>
                  <Label>Configurée</Label>
                  <Badge variant={selectedOrg.isConfigured ? 'default' : 'secondary'}>
                    {selectedOrg.isConfigured ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier l'organisation</DialogTitle>
            <DialogDescription>
              Modifier les informations et le plan de l'organisation
            </DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <OrganizationEditForm
              organization={selectedOrg}
              plans={plansData?.plans || []}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Edit Form Component
function OrganizationEditForm({
  organization,
  plans,
  onSuccess,
}: {
  organization: Organization;
  plans: any[];
  onSuccess: () => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(
    organization.plan?.id || 'none'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const actualPlanId = selectedPlanId === 'none' ? '' : selectedPlanId;
      if (actualPlanId && actualPlanId !== organization.plan?.id) {
        const response = await fetch(
          `/api/admin/organizations/${organization.id}/subscription`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ planId: actualPlanId }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erreur lors de la modification');
        }
      }

      toast.success('Organisation modifiée avec succès');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Plan</Label>
        <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucun plan</SelectItem>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
