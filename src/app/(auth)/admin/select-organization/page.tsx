'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDataQuery } from '@/hooks/use-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Shield,
  Building2,
  Search,
  Loader2,
  Users,
  Home,
  Check,
} from 'lucide-react';
import Link from 'next/link';

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
  userCount: number;
  unitCount: number;
  createdAt: string;
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
  page?: number;
}): Promise<OrganizationsResponse> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
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

export default function SelectOrganizationPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Check if user is super-admin (only on client)
  useEffect(() => {
    setIsMounted(true);
    
    async function checkSuperAdmin() {
      try {
        const response = await fetch('/api/admin/check-super-admin', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setIsSuperAdmin(data.isSuperAdmin);
          if (!data.isSuperAdmin) {
            router.push('/dashboard');
            toast.error('Accès refusé : vous devez être super-admin');
          }
        } else {
          setIsSuperAdmin(false);
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error checking super-admin:', error);
        setIsSuperAdmin(false);
        router.push('/dashboard');
      }
    }
    checkSuperAdmin();
  }, [router]);

  const { data, isLoading, error } = useDataQuery(
    ['admin-organizations-select', search],
    () => getOrganizations({ search })
  );

  const organizations = data?.organizations || [];

  const handleSelectOrganization = async () => {
    if (!selectedOrgId) {
      toast.error('Veuillez sélectionner une organisation');
      return;
    }

    setIsSubmitting(true);
    try {
      // Set the selected organization in session/localStorage
      // The backend will use this to filter data for the super-admin
      localStorage.setItem('superAdminSelectedOrgId', selectedOrgId);
      
      // Redirect to admin organizations page
      router.push('/admin/organizations');
      toast.success('Organisation sélectionnée');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sélection');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render until mounted to avoid hydration mismatch
  // Always render the same initial state to avoid hydration mismatch
  // Only show content after mount and super-admin check
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8" /> {/* Placeholder to maintain layout */}
      </div>
    );
  }

  if (isSuperAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isSuperAdmin === false) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-10 w-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Sélectionner une organisation
            </h1>
          </div>
          <p className="text-gray-600">
            En tant que super-admin, choisissez l'organisation à gérer
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher une organisation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Organizations List */}
        <Card>
          <CardHeader>
            <CardTitle>Organisations ({data?.pagination?.total || 0})</CardTitle>
            <CardDescription>
              Sélectionnez une organisation pour commencer
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
              <div className="space-y-2">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${
                        selectedOrgId === org.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Building2 className="h-5 w-5 text-gray-400" />
                          <h3 className="font-semibold text-gray-900">
                            {org.name || 'Sans nom'}
                          </h3>
                          {selectedOrgId === org.id && (
                            <Check className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="ml-8 space-y-1">
                          <div className="text-sm text-gray-600">
                            Slug: {org.slug || 'N/A'}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {org.userCount} utilisateurs
                            </div>
                            <div className="flex items-center gap-1">
                              <Home className="h-4 w-4" />
                              {org.unitCount} lots
                            </div>
                            {org.plan && (
                              <Badge variant="outline">{org.plan.displayName}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSelectOrganization}
            disabled={!selectedOrgId || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sélection...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Continuer avec cette organisation
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

