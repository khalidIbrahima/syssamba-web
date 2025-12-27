'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  UserCircle,
  Plus,
  Search,
  Building2,
  Home,
  TrendingUp,
  Clock,
  Calendar,
  Mail,
  Phone,
  CreditCard,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Fetch owners data
async function getOwners(params?: { search?: string; status?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append('search', params.search);
  if (params?.status) searchParams.append('status', params.status);

  const response = await fetch(`/api/owners?${searchParams.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch owners');
  }
  return response.json();
}

export default function OwnersPage() {
  const { canAccessFeature, canAccessObject } = useAccess();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { data, isLoading, refetch } = useDataQuery(
    ['owners', search, status],
    () => getOwners({ search, status })
  );

  // Check access - must be after all hooks (Rules of Hooks)
  // Owners are linked to properties, so check property access
  // User needs either canViewAllProperties OR canRead access
  const hasViewAllAccess = canAccessFeature('properties_management', 'canViewAllProperties');
  const hasReadAccess = canAccessObject('Property', 'read');
  
  if (!hasViewAllAccess && !hasReadAccess) {
    return (
      <AccessDenied
        featureName="Gestion des propriétaires"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const owners = data?.owners || [];
  const stats = data?.stats || {
    totalOwners: 0,
    activeOwners: 0,
    totalCompletedAmount: 0,
    totalPendingAmount: 0,
    totalScheduledAmount: 0,
    totalCommission: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propriétaires</h1>
          <p className="text-gray-600">Gérez vos propriétaires et leurs virements</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau propriétaire
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total propriétaires</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : stats.totalOwners}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Propriétaires actifs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : stats.activeOwners}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total viré</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : formatCurrency(stats.totalCompletedAmount)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">En attente</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : formatCurrency(stats.totalPendingAmount)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un propriétaire..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Owners Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des propriétaires</CardTitle>
          <CardDescription>
            {owners.length} propriétaire{owners.length > 1 ? 's' : ''} trouvé{owners.length > 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : owners.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PROPRIÉTAIRE</TableHead>
                  <TableHead>BIEN</TableHead>
                  <TableHead>COMMISSION</TableHead>
                  <TableHead>STATISTIQUES</TableHead>
                  <TableHead>MONTANTS</TableHead>
                  <TableHead>STATUT</TableHead>
                  <TableHead className="text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((owner: any) => (
                  <TableRow key={owner.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={null} />
                          <AvatarFallback>
                            {owner.firstName[0]}{owner.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {owner.firstName} {owner.lastName}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            {owner.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {owner.email}
                              </span>
                            )}
                            {owner.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {owner.phone}
                              </span>
                            )}
                          </div>
                          {owner.bankName && (
                            <p className="text-xs text-gray-500 mt-1">
                              {owner.bankName} • {owner.bankAccount}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{owner.propertyName || 'N/A'}</p>
                          <p className="text-sm text-gray-600">
                            {owner.stats.unitsCount} lot{owner.stats.unitsCount > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{owner.commissionRate}%</p>
                      <p className="text-sm text-gray-600">
                        {formatCurrency(owner.stats.totalCommission)} total
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <TrendingUp className="h-3 w-3 text-green-600" />
                          <span>{owner.stats.totalTransfers} virement{owner.stats.totalTransfers > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Home className="h-3 w-3" />
                          <span>{owner.stats.unitsCount} unité{owner.stats.unitsCount > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="text-gray-600">Effectué: </span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(owner.stats.completedAmount)}
                          </span>
                        </div>
                        {owner.stats.pendingAmount > 0 && (
                          <div className="text-sm">
                            <span className="text-gray-600">En attente: </span>
                            <span className="font-medium text-yellow-600">
                              {formatCurrency(owner.stats.pendingAmount)}
                            </span>
                          </div>
                        )}
                        {owner.stats.scheduledAmount > 0 && (
                          <div className="text-sm">
                            <span className="text-gray-600">Programmé: </span>
                            <span className="font-medium text-blue-600">
                              {formatCurrency(owner.stats.scheduledAmount)}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          owner.isActive
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-gray-100 text-gray-800 border-gray-200'
                        )}
                      >
                        {owner.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <UserCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <UserCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucun propriétaire
              </h3>
              <p className="text-gray-600 mb-6">
                {search || status !== 'all'
                  ? 'Aucun propriétaire ne correspond à vos critères de recherche.'
                  : 'Commencez par créer votre premier propriétaire.'}
              </p>
              {!search && status === 'all' && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau propriétaire
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
