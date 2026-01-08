'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Calendar, User, Home, CheckCircle, AlertCircle, Loader2, Eye, Edit } from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { useDataQuery } from '@/hooks/use-query';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';
import { usePageAccess } from '@/hooks/use-page-access';
import { FeatureGate } from '@/components/features/FeatureGate';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { format, parseISO, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// Fetch leases from API
async function getLeases() {
  const response = await fetch('/api/leases', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch leases');
  }
  return response.json();
}

export default function LeasesPage() {
  const { isLoading: isAccessLoading } = usePageAccess();
  const { data: leases, isLoading } = useDataQuery(['leases'], getLeases);

  // Wait for access data to load
  if (isAccessLoading || isLoading) {
    return <PageLoader message="Chargement..." />;
  }

  // Calculate statistics from real data
  const today = new Date();
  const thirtyDaysFromNow = addDays(today, 30);

  const activeLeases = leases?.filter((lease: any) => {
    if (!lease.endDate) return true; // No end date = active
    const endDate = typeof lease.endDate === 'string' ? parseISO(lease.endDate) : new Date(lease.endDate);
    return isAfter(endDate, today);
  }) || [];

  const expiringSoon = leases?.filter((lease: any) => {
    if (!lease.endDate) return false;
    const endDate = typeof lease.endDate === 'string' ? parseISO(lease.endDate) : new Date(lease.endDate);
    return isAfter(endDate, today) && isBefore(endDate, thirtyDaysFromNow);
  }) || [];

  const needsRenewal = leases?.filter((lease: any) => {
    if (!lease.endDate) return false;
    const endDate = typeof lease.endDate === 'string' ? parseISO(lease.endDate) : new Date(lease.endDate);
    const daysUntilExpiry = differenceInDays(endDate, today);
    return daysUntilExpiry <= 60 && daysUntilExpiry > 0;
  }) || [];

  const getLeaseStatus = (lease: any) => {
    if (!lease.endDate) return 'active';
    const endDate = typeof lease.endDate === 'string' ? parseISO(lease.endDate) : new Date(lease.endDate);
    if (isBefore(endDate, today)) return 'expired';
    if (isAfter(endDate, today)) return 'active';
    return 'active';
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(d, 'dd MMM yyyy', { locale: fr });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  };

  return (
    <FeatureGate
      feature="lease_management"
      showUpgrade={true}
    >
      <PermissionGate
        objectType="Lease"
        action="read"
        showDenied={true}
        deniedMessage="Vous n'avez pas la permission de voir les baux."
      >
        <div className="space-y-6 min-h-screen bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Baux</h1>
          <p className="text-muted-foreground">Gérez vos contrats de location</p>
        </div>
        <PermissionGate
          objectType="Lease"
          action="create"
          fallback={
            <Button disabled title="Permission requise pour créer des baux">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau bail
            </Button>
          }
        >
          <Button asChild>
            <Link href="/leases/new">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau bail
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Baux actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-3xl font-bold">{activeLeases.length}</div>
                <p className="text-sm text-muted-foreground">Contrats en cours</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-blue-600" />
              Échéances
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-3xl font-bold">{expiringSoon.length}</div>
                <p className="text-sm text-muted-foreground">Dans les 30 jours</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-yellow-600" />
              À renouveler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-3xl font-bold">{needsRenewal.length}</div>
                <p className="text-sm text-muted-foreground">Nécessitent attention</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contrats récents</CardTitle>
          <CardDescription>Liste des derniers baux créés</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : leases && leases.length > 0 ? (
            <div className="space-y-4">
              {leases.slice(0, 10).map((lease: any) => {
                const status = getLeaseStatus(lease);
                return (
                  <div key={lease.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium text-foreground">{lease.tenantName}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            <span>{lease.unitNumber}</span>
                          </div>
                          <span>•</span>
                          <span>{lease.propertyName}</span>
                          {lease.rentAmount && (
                            <>
                              <span>•</span>
                              <span className="font-medium">{formatCurrency(lease.rentAmount)}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Début: {formatDate(lease.startDate)}</span>
                          </div>
                          {lease.endDate && (
                            <>
                              <span>•</span>
                              <span>Fin: {formatDate(lease.endDate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={status === 'active' ? 'default' : 'secondary'}
                        className={
                          status === 'active'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : status === 'expired'
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            : 'bg-gray-100 dark:bg-gray-800 text-foreground'
                        }
                      >
                        {status === 'active' ? 'Actif' : status === 'expired' ? 'Expiré' : 'En attente'}
                      </Badge>
                      {!lease.signed && (
                        <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
                          Non signé
                        </Badge>
                      )}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/leases/${lease.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/leases/${lease.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Aucun bail
              </h3>
              <p className="text-muted-foreground mb-6">
                Commencez par créer votre premier bail.
              </p>
              <Button asChild>
                <Link href="/leases/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un bail
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
      </PermissionGate>
    </FeatureGate>
  );
}
