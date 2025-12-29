'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  RefreshCw,
  Shield,
  Zap,
  Building2,
  Users,
  Calculator,
  MessageSquare,
  FileText,
  CreditCard,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';

// Feature category icons
const categoryIcons = {
  'Core Features': Building2,
  'Property Management': Building2,
  'Financial': Calculator,
  'Communication': MessageSquare,
  'Administration': Shield,
  'Reporting': FileText,
  'Payments': CreditCard,
  'Advanced': Zap,
};

// Fetch plan features data
async function getPlanFeatures() {
  const response = await fetch('/api/admin/plan-features', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch plan features');
  }

  return response.json();
}

// Update plan feature
async function updatePlanFeature(planId: string, featureKey: string, isEnabled: boolean) {
  const response = await fetch('/api/admin/plan-features', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ planId, featureKey, isEnabled }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update plan feature');
  }

  return response.json();
}

// Bulk update plan features
async function bulkUpdatePlanFeatures(planId: string, features: Array<{ featureKey: string; isEnabled: boolean }>) {
  const response = await fetch('/api/admin/plan-features', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ planId, features }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update plan features');
  }

  return response.json();
}

export default function PlanFeaturesAdminPage() {
  const { data: planFeaturesData, isLoading, error, refetch } = useDataQuery(['plan-features-admin'], getPlanFeatures);
  const [updatingFeatures, setUpdatingFeatures] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState<string | null>(null);

  // Debug logging
  console.log('Plan Features Data:', planFeaturesData);
  console.log('Loading:', isLoading);
  console.log('Error:', error);

  const plans = planFeaturesData?.plans || [];

  // Calculate totals from the actual data
  const totalPlans = planFeaturesData?.totalPlans || 0;
  const totalFeatures = planFeaturesData?.totalPlanFeatureRecords || 0;

  const handleFeatureToggle = async (planId: string, featureId: string, currentValue: boolean) => {
    const updateKey = `${planId}-${featureId}`;
    setUpdatingFeatures(prev => new Set(prev).add(updateKey));

    try {
      await updatePlanFeature(planId, featureId, !currentValue); // Use featureId instead of featureKey
      toast.success(`Feature ${!currentValue ? 'enabled' : 'disabled'} successfully`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update feature');
    } finally {
      setUpdatingFeatures(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateKey);
        return newSet;
      });
    }
  };

  const handleBulkEnable = async (planId: string, category: string) => {
    const plan = plans.find((p: any) => p.plan.id === planId);
    if (!plan) return;

    const categoryFeatures = plan.featuresByCategory[category] || [];
    const featuresToUpdate = categoryFeatures
      .filter((f: any) => !f.isEnabled)
      .map((f: any) => ({ featureKey: f.featureKey, isEnabled: true }));

    if (featuresToUpdate.length === 0) {
      toast.info('All features in this category are already enabled');
      return;
    }

    setBulkUpdating(planId);

    try {
      await bulkUpdatePlanFeatures(planId, featuresToUpdate);
      toast.success(`Enabled ${featuresToUpdate.length} features in ${category}`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to enable features');
    } finally {
      setBulkUpdating(null);
    }
  };

  const handleBulkDisable = async (planId: string, category: string) => {
    const plan = plans.find((p: any) => p.plan.id === planId);
    if (!plan) return;

    const categoryFeatures = plan.featuresByCategory[category] || [];
    const featuresToUpdate = categoryFeatures
      .filter((f: any) => f.isEnabled)
      .map((f: any) => ({ featureKey: f.featureKey, isEnabled: false }));

    if (featuresToUpdate.length === 0) {
      toast.info('All features in this category are already disabled');
      return;
    }

    setBulkUpdating(planId);

    try {
      await bulkUpdatePlanFeatures(planId, featuresToUpdate);
      toast.success(`Disabled ${featuresToUpdate.length} features in ${category}`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable features');
    } finally {
      setBulkUpdating(null);
    }
  };

  const getCategoryStats = (plan: any, category: string) => {
    const features = plan.featuresByCategory[category] || [];
    const enabled = features.filter((f: any) => f.isEnabled).length;
    const total = features.length;
    return { enabled, total };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Chargement des fonctionnalités...</span>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('Plan features error:', error);
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Erreur lors du chargement des données</p>
          <p className="text-gray-600 text-sm">{error.message}</p>
          <Button onClick={() => refetch()} className="mt-4">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  if (!planFeaturesData || plans.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Aucune donnée de plan trouvée</p>
          <p className="text-gray-500 text-sm">Vérifiez que des plans existent dans la base de données</p>
          <Button onClick={() => refetch()} className="mt-4">
            Actualiser
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            Gestion des fonctionnalités par plan
          </h1>
          <p className="text-gray-600 mt-1">
            Configurez les fonctionnalités disponibles pour chaque plan d'abonnement
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* Plans Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((planData: any) => {
          const totalFeatures = planData.totalFeatures || planData.features.length;
          const enabledFeatures = planData.enabledFeatures || planData.features.filter((f: any) => f.isEnabled).length;
          const enabledPercentage = totalFeatures > 0 ? Math.round((enabledFeatures / totalFeatures) * 100) : 0;

          return (
            <Card key={planData.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{planData.displayName}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {enabledFeatures}/{totalFeatures}
                  </Badge>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${enabledPercentage}%` }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  {enabledPercentage}% des fonctionnalités activées
                </p>
                {planData.description && (
                  <p className="text-xs text-gray-500 mt-1">{planData.description}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Plan Features */}
      <Tabs defaultValue={plans[0]?.id} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {plans.map((planData: any) => (
            <TabsTrigger key={planData.id} value={planData.id} className="text-xs">
              {planData.displayName}
            </TabsTrigger>
          ))}
        </TabsList>

        {plans.map((planData: any) => (
          <TabsContent key={planData.id} value={planData.id} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Fonctionnalités du plan {planData.displayName}
                </CardTitle>
                <CardDescription>
                  Gérez les fonctionnalités disponibles pour ce plan d'abonnement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(planData.featuresByCategory).map(([category, features]) => {
                  const { enabled, total } = getCategoryStats(planData, category);
                  const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons] || Settings;

                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="h-5 w-5 text-blue-600" />
                          <h3 className="text-lg font-semibold">{category}</h3>
                          <Badge variant="outline" className="text-xs">
                            {enabled}/{total} activées
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBulkEnable(planData.id, category)}
                            disabled={bulkUpdating === planData.id}
                            className="text-xs"
                          >
                            {bulkUpdating === planData.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Tout activer'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBulkDisable(planData.id, category)}
                            disabled={bulkUpdating === planData.id}
                            className="text-xs"
                          >
                            {bulkUpdating === planData.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Tout désactiver'
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(features as any[]).map((feature: any) => {
                          const updateKey = `${planData.id}-${feature.featureId}`;
                          const isUpdating = updatingFeatures.has(updateKey);

                          return (
                            <div
                              key={feature.featureId}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{feature.featureName}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {feature.featureId.substring(0, 8)}...
                                  </Badge>
                                  {feature.isEnabled ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-400" />
                                  )}
                                </div>
                                {feature.featureDescription && (
                                  <p className="text-xs text-gray-500 mt-1">{feature.featureDescription}</p>
                                )}
                                {feature.limits && (
                                  <div className="mt-2">
                                    <p className="text-xs text-blue-600 font-medium">Limits:</p>
                                    <pre className="text-xs text-gray-600 bg-gray-50 p-1 rounded mt-1 overflow-x-auto">
                                      {JSON.stringify(feature.limits, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  Créé: {new Date(feature.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isUpdating ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Switch
                                    checked={feature.isEnabled}
                                    onCheckedChange={(checked) =>
                                      handleFeatureToggle(planData.id, feature.featureId, feature.isEnabled)
                                    }
                                    disabled={isUpdating}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
