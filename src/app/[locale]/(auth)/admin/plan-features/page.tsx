'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Shield,
  Zap,
  Building2,
  Calculator,
  MessageSquare,
  FileText,
  CreditCard,
  Search,
  Filter,
  X,
  Grid3x3,
  List,
  BarChart3,
  CheckCheck,
  AlertCircle,
  Copy,
  Download,
  Info,
  Plus,
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

// Get category icon component
const CategoryIcon = ({ category, className }: { category: string; className?: string }) => {
  const IconComponent = categoryIcons[category as keyof typeof categoryIcons] || Settings;
  return <IconComponent className={className} />;
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

// Fetch all features from database
async function getAllFeatures() {
  const response = await fetch('/api/admin/features', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch features');
  }

  const data = await response.json();
  return data.features || [];
}

// Update a specific plan_feature record by composite PK (planId, featureId)
async function updatePlanFeatureRecord(planId: string, featureId: string, updates: { isEnabled?: boolean; limits?: any }) {
  const response = await fetch('/api/admin/plan-features', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      planId,
      featureId,
      ...updates,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update plan feature record');
  }

  return response.json();
}

type ViewMode = 'matrix' | 'list' | 'stats';

export default function PlanFeaturesAdminPage() {
  const { data: planFeaturesData, isLoading, error, refetch } = useDataQuery(['plan-features-admin'], getPlanFeatures);
  const { data: allFeaturesData, refetch: refetchFeatures } = useDataQuery(['all-features'], getAllFeatures);
  const [updatingFeatures, setUpdatingFeatures] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  
  // Add feature to plan dialog state
  const [addFeatureDialogOpen, setAddFeatureDialogOpen] = useState(false);
  const [selectedPlanForAdd, setSelectedPlanForAdd] = useState<string | null>(null);
  const [addingFeature, setAddingFeature] = useState<string | null>(null);

  // Create new feature dialog state
  const [createFeatureDialogOpen, setCreateFeatureDialogOpen] = useState(false);
  const [creatingFeature, setCreatingFeature] = useState(false);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [newFeatureDisplayName, setNewFeatureDisplayName] = useState('');
  const [newFeatureDescription, setNewFeatureDescription] = useState('');
  const [newFeatureCategory, setNewFeatureCategory] = useState('');

  // Edit plan_feature record dialog state
  const [editPlanFeatureDialogOpen, setEditPlanFeatureDialogOpen] = useState(false);
  const [editingPlanFeature, setEditingPlanFeature] = useState<any>(null);
  const [editingIsEnabled, setEditingIsEnabled] = useState(false);
  const [editingLimits, setEditingLimits] = useState<{
    max_properties?: string;
    max_users?: string;
    max_units?: string;
    max_tenants?: string;
    max_leases?: string;
    max_tasks?: string;
    max_payments?: string;
    [key: string]: string | undefined;
  }>({});
  const [savingPlanFeature, setSavingPlanFeature] = useState(false);

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const plans = planFeaturesData?.plans || [];

  // Get all unique categories
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    plans.forEach((plan: any) => {
      plan.features.forEach((feature: any) => {
        categories.add(feature.category);
      });
    });
    return Array.from(categories).sort();
  }, [plans]);

  // Create a feature matrix: group all features across plans
  const featureMatrix = useMemo(() => {
    const matrix = new Map<string, {
      featureId: string;
      featureName: string;
      featureDescription: string | null;
      category: string;
      plans: Map<string, { isEnabled: boolean; limits: any; planId: string; featureId: string }>;
    }>();

    plans.forEach((plan: any) => {
      plan.features.forEach((feature: any) => {
        if (!matrix.has(feature.featureId)) {
          matrix.set(feature.featureId, {
            featureId: feature.featureId,
            featureName: feature.featureName,
            featureDescription: feature.featureDescription,
            category: feature.category,
            plans: new Map(),
          });
        }
        
        const featureData = matrix.get(feature.featureId)!;
        featureData.plans.set(plan.id, {
          isEnabled: feature.isEnabled,
          limits: feature.limits,
          planId: feature.planId, // Store plan_id for composite PK
          featureId: feature.featureId, // Store feature_id for composite PK
        });
      });
    });

    return matrix;
  }, [plans]);

  // Filter features based on search and filters
  const filteredFeatures = useMemo(() => {
    return Array.from(featureMatrix.values()).filter((feature) => {
      // Search filter
      const matchesSearch = !searchTerm ||
        feature.featureName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        feature.featureDescription?.toLowerCase().includes(searchTerm.toLowerCase());

      // Category filter
      const matchesCategory = categoryFilter === 'all' || feature.category === categoryFilter;

      // Status filter
      const enabledPlans = Array.from(feature.plans.values()).filter(p => p.isEnabled).length;
      const totalPlans = feature.plans.size;
      
      let matchesStatus = true;
      if (statusFilter === 'all-enabled') {
        matchesStatus = enabledPlans === totalPlans;
      } else if (statusFilter === 'all-disabled') {
        matchesStatus = enabledPlans === 0;
      } else if (statusFilter === 'some-enabled') {
        matchesStatus = enabledPlans > 0 && enabledPlans < totalPlans;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [featureMatrix, searchTerm, categoryFilter, statusFilter]);

  // Group filtered features by category
  const groupedFeatures = useMemo(() => {
    const groups = new Map<string, typeof filteredFeatures>();
    
    filteredFeatures.forEach((feature) => {
      if (!groups.has(feature.category)) {
        groups.set(feature.category, []);
      }
      groups.get(feature.category)!.push(feature);
    });

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredFeatures]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalFeatures = featureMatrix.size;
    const categoriesCount = allCategories.length;
    
    const planStats = plans.map((plan: any) => {
      const enabled = plan.features.filter((f: any) => f.isEnabled).length;
      const total = plan.features.length;
      return {
        id: plan.id,
        name: plan.displayName,
        enabled,
        total,
        percentage: total > 0 ? Math.round((enabled / total) * 100) : 0,
      };
    });

    const categoryStats = allCategories.map((category) => {
      const features = Array.from(featureMatrix.values()).filter(f => f.category === category);
      const totalInCategory = features.length;
      let enabledCount = 0;

      features.forEach((feature) => {
        const enabledInPlans = Array.from(feature.plans.values()).filter(p => p.isEnabled).length;
        if (enabledInPlans > 0) enabledCount++;
      });

      return {
        category,
        total: totalInCategory,
        enabled: enabledCount,
        percentage: totalInCategory > 0 ? Math.round((enabledCount / totalInCategory) * 100) : 0,
      };
    });

    return { totalFeatures, categoriesCount, planStats, categoryStats };
  }, [featureMatrix, plans, allCategories]);

  const handleFeatureToggle = async (planId: string, featureId: string, currentValue: boolean) => {
    const updateKey = `${planId}-${featureId}`;
    setUpdatingFeatures(prev => new Set(prev).add(updateKey));

    try {
      await updatePlanFeature(planId, featureId, !currentValue);
      toast.success(`Fonctionnalité ${!currentValue ? 'activée' : 'désactivée'}`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la mise à jour');
    } finally {
      setUpdatingFeatures(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateKey);
        return newSet;
      });
    }
  };

  const handleBulkEnableAll = async (planId: string) => {
    const plan = plans.find((p: any) => p.id === planId);
    if (!plan) return;

    const featuresToUpdate = plan.features
      .filter((f: any) => !f.isEnabled)
      .map((f: any) => ({ featureKey: f.featureId, isEnabled: true }));

    if (featuresToUpdate.length === 0) {
      toast.info('Toutes les fonctionnalités sont déjà activées');
      return;
    }

    setBulkUpdating(planId);

    try {
      await bulkUpdatePlanFeatures(planId, featuresToUpdate);
      toast.success(`${featuresToUpdate.length} fonctionnalités activées`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de l\'activation');
    } finally {
      setBulkUpdating(null);
    }
  };

  const handleBulkDisableAll = async (planId: string) => {
    const plan = plans.find((p: any) => p.id === planId);
    if (!plan) return;

    const featuresToUpdate = plan.features
      .filter((f: any) => f.isEnabled)
      .map((f: any) => ({ featureKey: f.featureId, isEnabled: false }));

    if (featuresToUpdate.length === 0) {
      toast.info('Toutes les fonctionnalités sont déjà désactivées');
      return;
    }

    setBulkUpdating(planId);

    try {
      await bulkUpdatePlanFeatures(planId, featuresToUpdate);
      toast.success(`${featuresToUpdate.length} fonctionnalités désactivées`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la désactivation');
    } finally {
      setBulkUpdating(null);
    }
  };

  // Get available features for a plan (features not yet added to the plan)
  const getAvailableFeaturesForPlan = (planId: string) => {
    const plan = plans.find((p: any) => p.id === planId);
    if (!plan) return [];

    // Get features already in the plan
    const planFeatureIds = new Set(plan.features.map((f: any) => f.featureId));
    
    // Use all features from database
    if (!allFeaturesData || allFeaturesData.length === 0) return [];
    
    // Map database features to the format expected by the UI
    return allFeaturesData
      .filter((feature: any) => !planFeatureIds.has(feature.id))
      .map((feature: any) => ({
        featureId: feature.id,
        featureName: feature.display_name || feature.name,
        featureDescription: feature.description,
        category: feature.category || 'Autres',
        plans: new Map(),
      }));
  };

  // Handle adding a new feature to a plan
  const handleAddFeatureToPlan = async (planId: string, featureId: string) => {
    setAddingFeature(featureId);

    try {
      await updatePlanFeature(planId, featureId, true);
      toast.success('Fonctionnalité ajoutée avec succès');
      refetch();
      
      // Check if there are more features to add, if not, close the dialog
      const availableFeatures = getAvailableFeaturesForPlan(planId);
      if (availableFeatures.length <= 1) {
        setAddFeatureDialogOpen(false);
        setSelectedPlanForAdd(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Échec de l\'ajout de la fonctionnalité');
    } finally {
      setAddingFeature(null);
    }
  };

  // Open add feature dialog for a plan
  const openAddFeatureDialog = (planId: string) => {
    setSelectedPlanForAdd(planId);
    setAddFeatureDialogOpen(true);
  };

  // Handle creating a new feature
  const handleCreateFeature = async () => {
    if (!newFeatureName || !newFeatureDisplayName || !newFeatureCategory) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setCreatingFeature(true);

    try {
      const response = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newFeatureName,
          displayName: newFeatureDisplayName,
          description: newFeatureDescription,
          category: newFeatureCategory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Échec de la création');
      }

      toast.success('Fonctionnalité créée avec succès');
      
      // Reset form
      setNewFeatureName('');
      setNewFeatureDisplayName('');
      setNewFeatureDescription('');
      setNewFeatureCategory('');
      setCreateFeatureDialogOpen(false);
      
      // Refresh data
      refetch();
      refetchFeatures();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la création de la fonctionnalité');
    } finally {
      setCreatingFeature(false);
    }
  };

  const copyPlanConfiguration = async (sourcePlanId: string, targetPlanId: string) => {
    const sourcePlan = plans.find((p: any) => p.id === sourcePlanId);
    const targetPlan = plans.find((p: any) => p.id === targetPlanId);
    
    if (!sourcePlan || !targetPlan) return;

    setBulkUpdating(targetPlanId);

    try {
      const featuresToUpdate = sourcePlan.features.map((f: any) => ({
        featureKey: f.featureId,
        isEnabled: f.isEnabled,
      }));

      await bulkUpdatePlanFeatures(targetPlanId, featuresToUpdate);
      toast.success(`Configuration copiée vers ${targetPlan.displayName}`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la copie');
    } finally {
      setBulkUpdating(null);
    }
  };

  const exportConfiguration = () => {
    const config = {
      exportDate: new Date().toISOString(),
      plans: plans.map((plan: any) => ({
        name: plan.name,
        displayName: plan.displayName,
        features: plan.features.map((f: any) => ({
          name: f.featureKey,
          displayName: f.featureName,
          isEnabled: f.isEnabled,
          category: f.category,
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-features-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Configuration exportée');
  };

  // Open edit dialog for a plan_feature record
  const openEditPlanFeatureDialog = (planId: string, featureId: string) => {
    const plan = plans.find((p: any) => p.id === planId);
    if (!plan) return;

    const feature = plan.features.find((f: any) => f.featureId === featureId);
    if (!feature) return;

    setEditingPlanFeature(feature);
    setEditingIsEnabled(feature.isEnabled);
    
    // Parse limits from JSON to form fields
    const limits = feature.limits || {};
    const limitsForm: any = {};
    Object.keys(limits).forEach(key => {
      const value = limits[key];
      // Convert to string, handling null/undefined
      limitsForm[key] = value === null || value === undefined ? '' : String(value);
    });
    setEditingLimits(limitsForm);
    
    setEditPlanFeatureDialogOpen(true);
  };

  // Handle saving plan_feature record
  const handleSavePlanFeature = async () => {
    if (!editingPlanFeature) return;

    setSavingPlanFeature(true);

    try {
      // Transform form fields to JSON
      const limits: any = {};
      Object.keys(editingLimits).forEach(key => {
        const value = editingLimits[key];
        if (value && value.trim() !== '') {
          // Try to parse as number, otherwise keep as string
          const numValue = Number(value);
          limits[key] = isNaN(numValue) ? value : numValue;
        }
      });

      // Only include limits if there are any values
      const limitsToSave = Object.keys(limits).length > 0 ? limits : null;

      await updatePlanFeatureRecord(editingPlanFeature.planId, editingPlanFeature.featureId, {
        isEnabled: editingIsEnabled,
        limits: limitsToSave,
      });

      toast.success('Enregistrement plan_feature mis à jour avec succès');
      setEditPlanFeatureDialogOpen(false);
      setEditingPlanFeature(null);
      setEditingLimits({});
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la mise à jour');
    } finally {
      setSavingPlanFeature(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground font-medium">Chargement des fonctionnalités...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <p className="text-red-600 font-semibold mb-2">Erreur lors du chargement</p>
                <p className="text-muted-foreground text-sm">{error.message}</p>
              </div>
              <Button onClick={() => { refetch(); refetchFeatures(); }} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!planFeaturesData || plans.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <p className="text-muted-foreground font-semibold mb-2">Aucune donnée disponible</p>
                <p className="text-muted-foreground text-sm">Vérifiez que des plans existent dans la base de données</p>
              </div>
              <Button onClick={() => { refetch(); refetchFeatures(); }} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Settings className="h-8 w-8 text-muted-foreground" />
            Gestion des Fonctionnalités
          </h1>
          <p className="text-muted-foreground mt-2">
            Configurez les fonctionnalités disponibles pour chaque plan d'abonnement
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setCreateFeatureDialogOpen(true)} 
            variant="default" 
            className="gap-2 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Fonctionnalité
          </Button>
          <Button onClick={exportConfiguration} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
          <Button onClick={() => { refetch(); refetchFeatures(); }} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Plans d'Abonnement</p>
                <p className="text-3xl font-bold text-foreground mt-1">{plans.length}</p>
              </div>
              <Shield className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fonctionnalités</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.totalFeatures}</p>
              </div>
              <Zap className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Catégories</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.categoriesCount}</p>
              </div>
              <Grid3x3 className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Résultats Filtrés</p>
                <p className="text-3xl font-bold text-foreground mt-1">{filteredFeatures.length}</p>
              </div>
              <Filter className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="matrix" className="gap-2">
            <Grid3x3 className="h-4 w-4" />
            Matrice
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Par Plan
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        {/* Filters - Shown for matrix and list views */}
        {(viewMode === 'matrix' || viewMode === 'list') && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-[250px]">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher des fonctionnalités..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Toutes les catégories
                      </div>
                    </SelectItem>
                    {allCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        <div className="flex items-center gap-2">
                          <CategoryIcon category={category} className="h-4 w-4" />
                          {category}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="all-enabled">Tous plans ON</SelectItem>
                    <SelectItem value="all-disabled">Tous plans OFF</SelectItem>
                    <SelectItem value="some-enabled">Configuration mixte</SelectItem>
                  </SelectContent>
                </Select>

                {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('all');
                      setStatusFilter('all');
                    }}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Réinitialiser
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Matrix View */}
        <TabsContent value="matrix" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid3x3 className="h-5 w-5" />
                Matrice des Fonctionnalités
              </CardTitle>
              <CardDescription>
                Vue d'ensemble complète • Cliquez sur les switches pour modifier les fonctionnalités
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted">
                      <th className="text-left p-4 font-semibold text-foreground sticky left-0 bg-muted z-10 min-w-[350px] border-r">
                        <div className="flex items-center gap-2">
                          <span>Fonctionnalité</span>
                          <Badge variant="secondary" className="text-xs">
                            {filteredFeatures.length}
                          </Badge>
                        </div>
                      </th>
                      {plans.map((planData: any) => (
                        <th key={planData.id} className="text-center p-4 min-w-[150px] border-l bg-muted">
                          <div className="flex flex-col items-center gap-2">
                            <div className="font-semibold text-foreground">{planData.displayName}</div>
                            <div className="text-xs text-muted-foreground font-normal">{planData.name}</div>
                            <div className="flex gap-1 mt-1 flex-wrap justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleBulkEnableAll(planData.id)}
                                disabled={bulkUpdating === planData.id}
                                className="text-xs h-6 px-2"
                                title="Tout activer"
                              >
                                {bulkUpdating === planData.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCheck className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleBulkDisableAll(planData.id)}
                                disabled={bulkUpdating === planData.id}
                                className="text-xs h-6 px-2"
                                title="Tout désactiver"
                              >
                                {bulkUpdating === planData.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openAddFeatureDialog(planData.id)}
                                className="text-xs h-6 px-2 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
                                title="Ajouter une fonctionnalité"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedFeatures.length === 0 ? (
                      <tr>
                        <td colSpan={plans.length + 1} className="p-8 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-3">
                            <Search className="h-12 w-12 text-muted-foreground" />
                            <p>Aucune fonctionnalité trouvée</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      groupedFeatures.map(([category, features]) => (
                        <React.Fragment key={category}>
                          {/* Category Header */}
                          <tr className="bg-muted border-t">
                            <td colSpan={plans.length + 1} className="p-3">
                              <div className="flex items-center gap-3">
                                <CategoryIcon category={category} className="h-5 w-5 text-muted-foreground" />
                                <span className="font-semibold text-foreground">{category}</span>
                                <Badge variant="secondary">
                                  {features.length}
                                </Badge>
                              </div>
                            </td>
                          </tr>

                          {/* Features in this category */}
                          {features.map((feature, idx) => (
                            <tr 
                              key={feature.featureId} 
                              className={`border-b hover:bg-muted ${idx % 2 === 0 ? 'bg-background' : 'bg-muted'}`}
                            >
                              <td className="p-4 sticky left-0 bg-inherit border-r">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">{feature.featureName}</span>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => setSelectedFeature(feature)}
                                        >
                                          <Info className="h-3 w-3 text-muted-foreground" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>{feature.featureName}</DialogTitle>
                                          <DialogDescription>
                                            {feature.featureDescription || 'Aucune description disponible'}
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <div>
                                            <p className="text-sm font-medium mb-2">Catégorie</p>
                                            <Badge>{feature.category}</Badge>
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium mb-2">Disponibilité par plan</p>
                                            <div className="space-y-2">
                                              {plans.map((plan: any) => {
                                                const planFeature = feature.plans.get(plan.id);
                                                return (
                                                  <div key={plan.id} className="flex items-center justify-between text-sm">
                                                    <span>{plan.displayName}</span>
                                                    {planFeature?.isEnabled ? (
                                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                    ) : (
                                                      <XCircle className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                  {feature.featureDescription && (
                                    <div className="text-sm text-muted-foreground line-clamp-2">{feature.featureDescription}</div>
                                  )}
                                </div>
                              </td>
                              {plans.map((planData: any) => {
                                const planFeature = feature.plans.get(planData.id);
                                const updateKey = `${planData.id}-${feature.featureId}`;
                                const isUpdating = updatingFeatures.has(updateKey);

                                return (
                                  <td key={planData.id} className="p-4 text-center border-l">
                                    <div className="flex flex-col items-center gap-2">
                                      {isUpdating ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                      ) : (
                                        <>
                                          <div className="flex items-center gap-1">
                                            <Switch
                                              checked={planFeature?.isEnabled || false}
                                              onCheckedChange={() =>
                                                handleFeatureToggle(
                                                  planData.id,
                                                  feature.featureId,
                                                  planFeature?.isEnabled || false
                                                )
                                              }
                                              disabled={isUpdating}
                                            />
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                              onClick={() => openEditPlanFeatureDialog(planData.id, feature.featureId)}
                                              title="Éditer l'enregistrement plan_feature"
                                            >
                                              <Settings className="h-3 w-3 text-muted-foreground" />
                                            </Button>
                                          </div>
                                          {planFeature?.isEnabled ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* List View */}
        <TabsContent value="list" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {plans.map((planData: any) => {
              const planFeatures = Array.from(featureMatrix.values())
                .filter(feature => feature.plans.has(planData.id))
                .filter(feature => {
                  const matchesSearch = !searchTerm ||
                    feature.featureName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    feature.featureDescription?.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesCategory = categoryFilter === 'all' || feature.category === categoryFilter;
                  const planFeatureData = feature.plans.get(planData.id);
                  const matchesStatus = statusFilter === 'all' ||
                    (statusFilter === 'all-enabled' && planFeatureData?.isEnabled) ||
                    (statusFilter === 'all-disabled' && !planFeatureData?.isEnabled);
                  return matchesSearch && matchesCategory && matchesStatus;
                });

              const enabledCount = planFeatures.filter(f => f.plans.get(planData.id)?.isEnabled).length;
              const percentage = planFeatures.length > 0 ? Math.round((enabledCount / planFeatures.length) * 100) : 0;

              return (
                <Card key={planData.id}>
                  <CardHeader className="border-b bg-muted">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{planData.displayName}</CardTitle>
                        <CardDescription className="mt-1">{planData.description || planData.name}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">{percentage}%</div>
                        <div className="text-xs text-muted-foreground">{enabledCount}/{planFeatures.length}</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                      <div
                        className="bg-gray-900 dark:bg-gray-800 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkEnableAll(planData.id)}
                        disabled={bulkUpdating === planData.id}
                        className="flex-1 min-w-[120px]"
                      >
                        <CheckCheck className="h-3 w-3 mr-2" />
                        Tout activer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkDisableAll(planData.id)}
                        disabled={bulkUpdating === planData.id}
                        className="flex-1 min-w-[120px]"
                      >
                        <XCircle className="h-3 w-3 mr-2" />
                        Tout désactiver
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openAddFeatureDialog(planData.id)}
                        className="flex-1 min-w-[120px] bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        Ajouter
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                    {planFeatures.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Filter className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm">Aucune fonctionnalité trouvée</p>
                      </div>
                    ) : (
                      planFeatures.map((feature) => {
                        const planFeatureData = feature.plans.get(planData.id);
                        const updateKey = `${planData.id}-${feature.featureId}`;
                        const isUpdating = updatingFeatures.has(updateKey);

                        return (
                          <div
                            key={feature.featureId}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2 mb-1">
                                <CategoryIcon category={feature.category} className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{feature.featureName}</span>
                              </div>
                              {feature.featureDescription && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{feature.featureDescription}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {planFeatureData?.isEnabled ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-muted-foreground" />
                              )}
                              {isUpdating ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <>
                                  <Switch
                                    checked={planFeatureData?.isEnabled || false}
                                    onCheckedChange={() =>
                                      handleFeatureToggle(
                                        planData.id,
                                        feature.featureId,
                                        planFeatureData?.isEnabled || false
                                      )
                                    }
                                    disabled={isUpdating}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => openEditPlanFeatureDialog(planData.id, feature.featureId)}
                                    title="Éditer l'enregistrement plan_feature"
                                  >
                                    <Settings className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Statistics View */}
        <TabsContent value="stats" className="mt-0 space-y-6">
          {/* Plan Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Statistiques par Plan
              </CardTitle>
              <CardDescription>
                Pourcentage de fonctionnalités activées pour chaque plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.planStats.map((planStat: any) => (
                  <div key={planStat.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{planStat.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {planStat.enabled} / {planStat.total}
                        </span>
                        <span className="font-bold text-foreground w-12 text-right">
                          {planStat.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gray-900 dark:bg-gray-800 h-3 rounded-full transition-all"
                        style={{ width: `${planStat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Category Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid3x3 className="h-5 w-5" />
                Statistiques par Catégorie
              </CardTitle>
              <CardDescription>
                Utilisation des fonctionnalités par catégorie
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats.categoryStats.map((catStat: any) => (
                  <div key={catStat.category} className="space-y-3 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CategoryIcon category={catStat.category} className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{catStat.category}</span>
                      </div>
                      <Badge variant="secondary">{catStat.total}</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Activées</span>
                        <span className="font-semibold text-foreground">
                          {catStat.enabled} / {catStat.total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gray-900 dark:bg-gray-800 h-2 rounded-full transition-all"
                          style={{ width: `${catStat.percentage}%` }}
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-foreground">{catStat.percentage}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Overall Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                Résumé Global
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-4xl font-bold text-foreground mb-2">{plans.length}</div>
                  <div className="text-sm text-muted-foreground">Plans d'abonnement</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-4xl font-bold text-foreground mb-2">{stats.totalFeatures}</div>
                  <div className="text-sm text-muted-foreground">Fonctionnalités totales</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-4xl font-bold text-foreground mb-2">{stats.categoriesCount}</div>
                  <div className="text-sm text-muted-foreground">Catégories</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Feature Dialog */}
      <Dialog open={addFeatureDialogOpen} onOpenChange={setAddFeatureDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter une fonctionnalité</DialogTitle>
            <DialogDescription>
              {selectedPlanForAdd && (
                <>
                  Sélectionnez une fonctionnalité à ajouter au plan{' '}
                  <strong>{plans.find((p: any) => p.id === selectedPlanForAdd)?.displayName}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPlanForAdd && (
            <div className="space-y-3 mt-4">
              {(() => {
                const availableFeatures = getAvailableFeaturesForPlan(selectedPlanForAdd);
                const groupedAvailable = new Map<string, typeof availableFeatures>();
                
                availableFeatures.forEach((feature: any) => {
                  if (!groupedAvailable.has(feature.category)) {
                    groupedAvailable.set(feature.category, []);
                  }
                  groupedAvailable.get(feature.category)!.push(feature);
                });

                if (availableFeatures.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                      <p className="font-medium">Toutes les fonctionnalités sont déjà ajoutées</p>
                      <p className="text-sm mt-1">Ce plan contient toutes les fonctionnalités disponibles.</p>
                    </div>
                  );
                }

                return Array.from(groupedAvailable.entries()).map(([category, features]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                      <CategoryIcon category={category} className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm text-foreground">{category}</span>
                      <Badge variant="secondary" className="text-xs">{features.length}</Badge>
                    </div>
                    {features.map((feature: any) => (
                      <div
                        key={feature.featureId}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="font-medium text-sm text-foreground">{feature.featureName}</div>
                          {feature.featureDescription && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {feature.featureDescription}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddFeatureToPlan(selectedPlanForAdd, feature.featureId)}
                          disabled={addingFeature === feature.featureId}
                          className="bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
                        >
                          {addingFeature === feature.featureId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              Ajouter
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create New Feature Dialog */}
      <Dialog open={createFeatureDialogOpen} onOpenChange={setCreateFeatureDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer une Nouvelle Fonctionnalité</DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle fonctionnalité qui pourra être assignée à des plans
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Name (key) */}
            <div className="space-y-2">
              <Label htmlFor="feature-name">
                Nom (clé) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="feature-name"
                placeholder="ex: advanced_analytics"
                value={newFeatureName}
                onChange={(e) => setNewFeatureName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                disabled={creatingFeature}
              />
              <p className="text-xs text-muted-foreground">
                Utiliser snake_case (lettres minuscules et underscores)
              </p>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="feature-display-name">
                Nom d'affichage <span className="text-red-500">*</span>
              </Label>
              <Input
                id="feature-display-name"
                placeholder="ex: Analytiques Avancées"
                value={newFeatureDisplayName}
                onChange={(e) => setNewFeatureDisplayName(e.target.value)}
                disabled={creatingFeature}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="feature-category">
                Catégorie <span className="text-red-500">*</span>
              </Label>
              <Select
                value={newFeatureCategory}
                onValueChange={setNewFeatureCategory}
                disabled={creatingFeature}
              >
                <SelectTrigger id="feature-category">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ Nouvelle catégorie...</SelectItem>
                </SelectContent>
              </Select>
              {newFeatureCategory === '__new__' && (
                <Input
                  placeholder="Entrer nouvelle catégorie"
                  onChange={(e) => {
                    if (e.target.value) {
                      setNewFeatureCategory(e.target.value);
                    }
                  }}
                  autoFocus
                />
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="feature-description">Description</Label>
              <Textarea
                id="feature-description"
                placeholder="Décrivez la fonctionnalité..."
                value={newFeatureDescription}
                onChange={(e) => setNewFeatureDescription(e.target.value)}
                disabled={creatingFeature}
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreateFeature}
                disabled={creatingFeature || !newFeatureName || !newFeatureDisplayName || !newFeatureCategory || newFeatureCategory === '__new__'}
                className="flex-1 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
              >
                {creatingFeature ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  setCreateFeatureDialogOpen(false);
                  setNewFeatureName('');
                  setNewFeatureDisplayName('');
                  setNewFeatureDescription('');
                  setNewFeatureCategory('');
                }}
                variant="outline"
                disabled={creatingFeature}
              >
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Feature Record Dialog */}
      <Dialog open={editPlanFeatureDialogOpen} onOpenChange={setEditPlanFeatureDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Éditer l'enregistrement Plan Feature</DialogTitle>
            <DialogDescription>
              {editingPlanFeature && (
                <>
                  Modifier les paramètres pour{' '}
                  <strong>{plans.find((p: any) => p.id === editingPlanFeature.planId)?.displayName}</strong>
                  {' - '}
                  <strong>{editingPlanFeature.featureName}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {editingPlanFeature && (
            <div className="space-y-4 mt-4">
              {/* Plan and Feature Info */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Plan:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {plans.find((p: any) => p.id === editingPlanFeature.planId)?.displayName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Fonctionnalité:</span>
                  <span className="text-sm font-semibold text-foreground">{editingPlanFeature.featureName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Plan ID:</span>
                  <span className="text-xs font-mono text-muted-foreground">{editingPlanFeature.planId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Feature ID:</span>
                  <span className="text-xs font-mono text-muted-foreground">{editingPlanFeature.featureId}</span>
                </div>
              </div>

              {/* Is Enabled */}
              <div className="space-y-2">
                <Label htmlFor="is-enabled" className="flex items-center justify-between">
                  <span>Activé</span>
                  <Switch
                    id="is-enabled"
                    checked={editingIsEnabled}
                    onCheckedChange={setEditingIsEnabled}
                    disabled={savingPlanFeature}
                  />
                </Label>
                <p className="text-xs text-muted-foreground">
                  Détermine si cette fonctionnalité est activée pour ce plan
                </p>
              </div>

              {/* Limits (Form Fields) */}
              <div className="space-y-4">
                <Label>Limites spécifiques</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="limit-max-properties" className="text-sm font-medium">
                      Max Propriétés
                    </Label>
                    <Input
                      id="limit-max-properties"
                      type="number"
                      placeholder="Illimité"
                      value={editingLimits.max_properties || ''}
                      onChange={(e) => setEditingLimits(prev => ({ ...prev, max_properties: e.target.value }))}
                      disabled={savingPlanFeature}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="limit-max-users" className="text-sm font-medium">
                      Max Utilisateurs
                    </Label>
                    <Input
                      id="limit-max-users"
                      type="number"
                      placeholder="Illimité"
                      value={editingLimits.max_users || ''}
                      onChange={(e) => setEditingLimits(prev => ({ ...prev, max_users: e.target.value }))}
                      disabled={savingPlanFeature}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="limit-max-units" className="text-sm font-medium">
                      Max Lots/Unités
                    </Label>
                    <Input
                      id="limit-max-units"
                      type="number"
                      placeholder="Illimité"
                      value={editingLimits.max_units || ''}
                      onChange={(e) => setEditingLimits(prev => ({ ...prev, max_units: e.target.value }))}
                      disabled={savingPlanFeature}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="limit-max-tenants" className="text-sm font-medium">
                      Max Locataires
                    </Label>
                    <Input
                      id="limit-max-tenants"
                      type="number"
                      placeholder="Illimité"
                      value={editingLimits.max_tenants || ''}
                      onChange={(e) => setEditingLimits(prev => ({ ...prev, max_tenants: e.target.value }))}
                      disabled={savingPlanFeature}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="limit-max-leases" className="text-sm font-medium">
                      Max Contrats
                    </Label>
                    <Input
                      id="limit-max-leases"
                      type="number"
                      placeholder="Illimité"
                      value={editingLimits.max_leases || ''}
                      onChange={(e) => setEditingLimits(prev => ({ ...prev, max_leases: e.target.value }))}
                      disabled={savingPlanFeature}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="limit-max-tasks" className="text-sm font-medium">
                      Max Tâches
                    </Label>
                    <Input
                      id="limit-max-tasks"
                      type="number"
                      placeholder="Illimité"
                      value={editingLimits.max_tasks || ''}
                      onChange={(e) => setEditingLimits(prev => ({ ...prev, max_tasks: e.target.value }))}
                      disabled={savingPlanFeature}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="limit-max-payments" className="text-sm font-medium">
                      Max Paiements
                    </Label>
                    <Input
                      id="limit-max-payments"
                      type="number"
                      placeholder="Illimité"
                      value={editingLimits.max_payments || ''}
                      onChange={(e) => setEditingLimits(prev => ({ ...prev, max_payments: e.target.value }))}
                      disabled={savingPlanFeature}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="limit-custom-key" className="text-sm font-medium">
                    Limite personnalisée (clé)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="limit-custom-key"
                      placeholder="ex: max_documents"
                      value={editingLimits._customKey || ''}
                      onChange={(e) => setEditingLimits(prev => ({ ...prev, _customKey: e.target.value }))}
                      disabled={savingPlanFeature}
                      className="flex-1"
                    />
                    <Input
                      id="limit-custom-value"
                      type="number"
                      placeholder="Valeur"
                      value={editingLimits._customValue || ''}
                      onChange={(e) => setEditingLimits(prev => ({ ...prev, _customValue: e.target.value }))}
                      disabled={savingPlanFeature}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const key = editingLimits._customKey;
                        const value = editingLimits._customValue;
                        if (key && value) {
                          setEditingLimits(prev => {
                            const newLimits = { ...prev };
                            newLimits[key] = value;
                            delete newLimits._customKey;
                            delete newLimits._customValue;
                            return newLimits;
                          });
                        }
                      }}
                      disabled={savingPlanFeature || !editingLimits._customKey || !editingLimits._customValue}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Laissez les champs vides pour aucune limite. Les valeurs numériques seront converties automatiquement en JSON.
                </p>
                
                {/* Display current limits as JSON preview */}
                {Object.keys(editingLimits).filter(k => !k.startsWith('_')).length > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">Aperçu JSON:</Label>
                    <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(editingLimits)
                            .filter(([k]) => !k.startsWith('_'))
                            .map(([k, v]) => [k, v && v.trim() ? (isNaN(Number(v)) ? v : Number(v)) : null])
                            .filter(([_, v]) => v !== null && v !== '')
                        ),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSavePlanFeature}
                  disabled={savingPlanFeature}
                  className="flex-1 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
                >
                  {savingPlanFeature ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setEditPlanFeatureDialogOpen(false);
                    setEditingPlanFeature(null);
                    setEditingLimits({});
                  }}
                  variant="outline"
                  disabled={savingPlanFeature}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
