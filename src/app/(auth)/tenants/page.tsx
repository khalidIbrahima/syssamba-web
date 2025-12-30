'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  Globe,
  MoreHorizontal,
  Edit,
  Eye,
  UserCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  AlertCircle,
  Calendar,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { usePageAccess } from '@/hooks/use-page-access';
import { PageLoader } from '@/components/ui/page-loader';
import { useDataQuery } from '@/hooks/use-query';
import { useOrganization } from '@/hooks/use-organization';
import { AccessDenied } from '@/components/ui/access-denied';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TenantMessageDialog } from '@/components/tenants/tenant-message-dialog';

// Fetch tenants from API
async function getTenants() {
  const response = await fetch('/api/tenants', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch tenants');
  }
  return response.json();
}

export default function TenantsPage() {
  const { canAccessFeature, canAccessObject, isLoading: isAccessLoading } = usePageAccess();
  const { limits, currentUsage } = usePlan();
  const { organizationId } = useOrganization();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedTenantName, setSelectedTenantName] = useState<string | null>(null);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);

  const { data: tenants, isLoading } = useDataQuery(['tenants'], getTenants);

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  // Check access: user needs either canViewAllTenants OR canRead access
  const hasViewAllAccess = canAccessFeature('tenants_basic', 'canViewAllTenants');
  const hasReadAccess = canAccessObject('Tenant', 'read');
  const canCreate = canAccessObject('Tenant', 'create');
  
  if (!hasViewAllAccess && !hasReadAccess) {
    return (
      <AccessDenied
        featureName="Gestion des locataires"
        requiredPlan="starter"
        icon="shield"
      />
    );
  }

  // Calculate statistics
  // Active tenants: tenants with active lease (not expired, not null)
  const activeTenants = tenants?.filter((t: any) => {
    // Tenant is active if:
    // 1. Has a unit assigned (unitId exists)
    // 2. Has an active lease (leaseStatus === 'active' or 'notice')
    // 3. Lease is not expired (leaseStatus !== 'expired')
    if (!t.unitId) return false;
    
    // Only count as active if lease status is explicitly 'active' or 'notice'
    // Don't count if leaseStatus is null (no lease) or 'expired'
    return t.leaseStatus === 'active' || t.leaseStatus === 'notice';
  }) || [];
  
  // Total tenants count
  const totalTenants = tenants?.length || 0;
  
  // Extranet enabled tenants - count from actual tenant data, not from currentUsage
  // currentUsage might be out of sync, so we calculate from the actual tenants list
  const extranetEnabledCount = tenants?.filter((t: any) => t.hasExtranetAccess === true).length || 0;
  
  // Get extranet limit from plan - ensure we use real DB data
  // limits comes from usePlan() which fetches from /api/organization/plan
  // which uses getPlanLimitsFromDB() to get real data from database
  const extranetLimitValue = limits?.extranetTenants;
  
  // Debug logging
  if (typeof extranetLimitValue === 'undefined') {
    console.warn('[TenantsPage] extranetTenants limit is undefined. Limits object:', limits);
  }
  
  // Handle limit: -1 means unlimited (Infinity), null/undefined means use fallback, 0 means 0, otherwise use the value
  const extranetLimit = (extranetLimitValue === undefined || extranetLimitValue === null || extranetLimitValue === -1) 
    ? Infinity 
    : (extranetLimitValue === 0 ? 0 : extranetLimitValue);
  
  // Calculate progress percentage
  const extranetProgress = (extranetLimit === Infinity || extranetLimit === 0 || !extranetLimit || isNaN(extranetLimit)) 
    ? 0 
    : Math.min(100, Math.round((extranetEnabledCount / extranetLimit) * 100));
  
  const isExtranetLimitReached = extranetLimit !== Infinity && extranetLimit > 0 && !isNaN(extranetLimit) && extranetEnabledCount >= extranetLimit;

  // Get unique properties for filter
  const allProperties = Array.from(
    new Set(tenants?.map((t: any) => t.propertyName).filter(Boolean) || [])
  );

  // Filter tenants
  const filteredTenants = tenants?.filter((tenant: any) => {
    const matchesSearch = 
      `${tenant.firstName} ${tenant.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.phone?.includes(searchTerm);
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && (tenant.leaseStatus === 'active' || tenant.leaseStatus === null)) ||
      (statusFilter === 'late' && tenant.paymentStatus === 'late') ||
      (statusFilter === 'notice' && tenant.leaseStatus === 'notice');
    
    const matchesProperty = 
      propertyFilter === 'all' || tenant.propertyName === propertyFilter;

    return matchesSearch && matchesStatus && matchesProperty;
  }) || [];

  const totalFiltered = filteredTenants.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage);
  const currentTenants = filteredTenants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(d, 'dd/MM/yy', { locale: fr });
  };

  const getStatusBadge = (tenant: any) => {
    if (tenant.paymentStatus === 'late') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          En retard
        </Badge>
      );
    }
    if (tenant.leaseStatus === 'notice') {
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
          Préavis
        </Badge>
      );
    }
    if (tenant.leaseStatus === 'expired') {
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-200">
          Expiré
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        Actif
      </Badge>
    );
  };

  const getPaymentStatusBar = (tenant: any) => {
    if (tenant.paymentStatus === 'late') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 font-medium">
              Retard {tenant.daysLate} jour{tenant.daysLate > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      );
    }
    if (tenant.leaseStatus === 'notice' && tenant.leaseEndDate) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-700 font-medium">
              Fin bail: {formatDate(tenant.leaseEndDate)}
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 font-medium">Loyer à jour</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Annuaire des Locataires</h1>
          <p className="text-gray-600 mt-1">
            {isLoading ? (
              'Chargement...'
            ) : (
              `Gérez vos ${totalTenants} locataire${totalTenants > 1 ? 's' : ''} avec recherche et filtres avancés`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button asChild>
            <Link href="/tenants/new">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau locataire
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Locataires actifs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : activeTenants.length}
                </p>
                {!isLoading && totalTenants > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    sur {totalTenants} locataire{totalTenants > 1 ? 's' : ''} total{totalTenants > 1 ? 'aux' : ''}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Extranet activés</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : (
                    <>
                      {extranetEnabledCount}
                      {extranetLimit !== Infinity && extranetLimit > 0 && `/${extranetLimit}`}
                    </>
                  )}
                </p>
                {!isLoading && extranetLimit !== Infinity && extranetLimit > 0 && !isNaN(extranetProgress) && (
                  <p className="text-xs text-gray-500 mt-1">
                    {extranetProgress}% de la limite utilisée
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom, téléphone, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="late">En retard</SelectItem>
                  <SelectItem value="notice">Préavis</SelectItem>
                </SelectContent>
              </Select>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Tous les biens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les biens</SelectItem>
                  {allProperties.map((property: any) => (
                    <SelectItem key={property} value={property}>
                      {property}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" className="w-full sm:w-auto">
              Filtres avancés
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 w-16 bg-gray-200 rounded-full mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-24 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : currentTenants && currentTenants.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentTenants.map((tenant: any) => (
            <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <Avatar className="h-16 w-16">
                    <AvatarImage 
                      src={`https://ui-avatars.com/api/?name=${tenant.firstName}+${tenant.lastName}&background=random`} 
                      alt={`${tenant.firstName} ${tenant.lastName}`} 
                    />
                    <AvatarFallback>
                      {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedTenantId(tenant.id);
                        setSelectedTenantName(`${tenant.firstName} ${tenant.lastName}`);
                        setIsMessageDialogOpen(true);
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {tenant.firstName} {tenant.lastName}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(tenant)}
                  </div>
                  <p className="text-sm text-gray-600">
                    {tenant.unitNumber} - {tenant.propertyName}
                  </p>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-3 w-3" />
                    <span>{tenant.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{tenant.email || 'N/A'}</span>
                  </div>
                  {tenant.rentAmount && (
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(tenant.rentAmount)}/mois
                    </p>
                  )}
                </div>

                {getPaymentStatusBar(tenant)}

                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link href={`/tenants/${tenant.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      Voir
                    </Link>
                  </Button>
                </div>

                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {tenant.hasExtranetAccess ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-gray-600">Extranet: Activé</span>
                      </>
                    ) : (
                      <>
                        <div className="h-4 w-4 rounded-full bg-gray-300"></div>
                        <span className="text-xs text-gray-600">Extranet: Non activé</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun locataire trouvé
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== 'all' || propertyFilter !== 'all'
                ? 'Aucun locataire ne correspond à vos critères de recherche.'
                : 'Commencez par ajouter votre premier locataire.'}
            </p>
            {(!searchTerm && statusFilter === 'all' && propertyFilter === 'all') && (
              canCreate ? (
                <Button asChild>
                  <Link href="/tenants/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un locataire
                  </Link>
                </Button>
              ) : (
                <Button disabled title="Permission requise pour créer des locataires">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un locataire
                </Button>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalFiltered > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Affichage de {(currentPage - 1) * itemsPerPage + 1} à{' '}
            {Math.min(currentPage * itemsPerPage, totalFiltered)} sur {totalFiltered} locataires
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {[...Array(Math.min(totalPages, 11))].map((_, i) => {
              const page = i + 1;
              if (totalPages > 11 && i === 10) {
                return (
                  <Button
                    key="ellipsis"
                    variant="outline"
                    size="sm"
                    disabled
                    className="cursor-default"
                  >
                    ...
                  </Button>
                );
              }
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={currentPage === page ? 'bg-blue-600 text-white' : ''}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Extranet Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Extranet Locataires</h3>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    {extranetLimit === Infinity || extranetLimit === 0 || !extranetLimit ? (
                      <>
                        {extranetEnabledCount} locataire{extranetEnabledCount > 1 ? 's' : ''} ont accès à leur espace personnel
                        <span className="ml-2 text-blue-600 font-semibold">(Illimité)</span>
                      </>
                    ) : (
                      <>
                        {extranetEnabledCount} sur {extranetLimit} locataire{extranetLimit > 1 ? 's' : ''} ont accès à leur espace personnel
                        {isExtranetLimitReached && (
                          <span className="ml-2 text-orange-600 font-semibold">(Limite atteinte)</span>
                        )}
                      </>
                    )}
                  </p>
                  {extranetLimit !== Infinity && extranetLimit > 0 && !isNaN(extranetProgress) && (
                    <div className="space-y-2">
                      <Progress 
                        value={extranetProgress} 
                        className={cn(
                          "h-2",
                          isExtranetLimitReached && "bg-orange-200"
                        )}
                      />
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{extranetProgress}% utilisé</span>
                        <span>
                          {extranetLimit - extranetEnabledCount > 0 
                            ? `${extranetLimit - extranetEnabledCount} place${extranetLimit - extranetEnabledCount > 1 ? 's' : ''} restante${extranetLimit - extranetEnabledCount > 1 ? 's' : ''}`
                            : 'Aucune place restante'
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {!isLoading && (
              <div className="flex flex-col gap-2">
                {isExtranetLimitReached && (
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white whitespace-nowrap">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Passer à illimité
                  </Button>
                )}
                {extranetLimit !== Infinity && extranetLimit > 0 && !isNaN(extranetProgress) && extranetProgress >= 80 && !isExtranetLimitReached && (
                  <Button variant="outline" className="whitespace-nowrap">
                    <Globe className="h-4 w-4 mr-2" />
                    Augmenter la limite
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tenant Message Dialog */}
      {organizationId && (
        <TenantMessageDialog
          open={isMessageDialogOpen}
          onOpenChange={setIsMessageDialogOpen}
          tenantId={selectedTenantId}
          organizationId={organizationId}
          tenantName={selectedTenantName || undefined}
        />
      )}
    </div>
  );
}
