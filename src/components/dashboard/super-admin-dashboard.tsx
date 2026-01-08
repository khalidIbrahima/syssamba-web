'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  Home,
  Layers,
  UserCheck,
  CreditCard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { useDataQuery } from '@/hooks/use-query';

// Fetch admin statistics from API
async function getAdminStatistics() {
  const response = await fetch('/api/admin/statistics', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch admin statistics');
  }
  return response.json();
}

export function SuperAdminDashboard() {
  const { data, isLoading } = useDataQuery(['admin-statistics'], getAdminStatistics);

  if (isLoading) {
    return (
      <div className="space-y-6 min-h-screen bg-background">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.overview || {};
  const orgTypes = data?.organizationsByType || {};
  const subscriptionsByPlan = data?.subscriptionsByPlan || {};

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 min-h-screen bg-background">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Super Admin</h1>
        <p className="text-muted-foreground mt-2">
          Vue d'ensemble globale de toutes les organisations
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Organizations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Organisations
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {stats.totalOrganizations || 0}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  stats.growthRate && stats.growthRate > 0
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : stats.growthRate && stats.growthRate < 0
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                }
                variant="outline"
              >
                {stats.growthRate && stats.growthRate > 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : stats.growthRate && stats.growthRate < 0 ? (
                  <TrendingDown className="h-3 w-3 mr-1" />
                ) : null}
                {stats.growthRate || 0}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                {stats.newOrganizationsThisMonth || 0} ce mois
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utilisateurs
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {stats.totalUsers || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Utilisateurs actifs
            </div>
          </CardContent>
        </Card>

        {/* Total Properties */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Biens
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Home className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {stats.totalProperties || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Biens immobiliers
            </div>
          </CardContent>
        </Card>

        {/* Total Units */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lots
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Layers className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {stats.totalUnits || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Lots gérés
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue and Subscriptions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenus totaux</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(stats.totalRevenue || 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Revenus du mois</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(stats.monthlyRevenue || 0)}
                  </p>
                </div>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Abonnements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-foreground mb-1">
                  {stats.activeSubscriptions || 0}
                </div>
                <p className="text-sm text-muted-foreground">Abonnements actifs</p>
              </div>
              <div className="pt-4 border-t">
                <div className="text-lg font-semibold text-foreground mb-2">
                  {stats.freemiumOrganizations || 0}
                </div>
                <p className="text-sm text-muted-foreground">Sur plan gratuit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution by Type and Plan */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Organizations by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Organisations par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(orgTypes).map(([type, count]: [string, any]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                    <span className="text-sm font-medium text-foreground capitalize">
                      {type === 'agency' ? 'Agence' :
                       type === 'sci' ? 'SCI' :
                       type === 'syndic' ? 'Syndic' :
                       'Individuel'}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{count}</span>
                </div>
              ))}
              {Object.keys(orgTypes).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune organisation
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions by Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Abonnements par plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(subscriptionsByPlan).map(([planName, count]: [string, any]) => (
                <div key={planName} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-600"></div>
                    <span className="text-sm font-medium text-foreground">
                      {planName}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{count}</span>
                </div>
              ))}
              {Object.keys(subscriptionsByPlan).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun abonnement actif
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Tenants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Locataires
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {stats.totalTenants || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {stats.extranetTenantsCount || 0} avec extranet
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/organizations"
              className="p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <Building2 className="h-5 w-5 mb-2 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-foreground">Gérer les organisations</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Voir et gérer toutes les organisations
              </p>
            </Link>
            <Link
              href="/admin/plans"
              className="p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <CreditCard className="h-5 w-5 mb-2 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-foreground">Gérer les plans</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configurer les plans d'abonnement
              </p>
            </Link>
            <Link
              href="/admin/users"
              className="p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <Users className="h-5 w-5 mb-2 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-foreground">Gérer les utilisateurs</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Voir tous les utilisateurs
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

