'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Settings,
  Edit,
  Loader2,
  RefreshCw,
  DollarSign,
  Users,
  Home,
  Globe,
  Plus,
  Building2,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';
import { usePageAccess } from '@/hooks/use-page-access';
import { PageLoader } from '@/components/ui/page-loader';
import { useSuperAdmin } from '@/hooks/use-super-admin';

// Fetch plans data
async function getPlans() {
  const response = await fetch('/api/admin/plans', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }

  return response.json();
}

// Create plan
async function createPlan(planData: any) {
  const response = await fetch('/api/admin/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(planData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create plan');
  }

  return response.json();
}

// Update plan
async function updatePlan(planId: string, updates: any) {
  const response = await fetch('/api/admin/plans', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      id: planId,
      ...updates,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update plan');
  }

  return response.json();
}

export default function PlansAdminPage() {
  const { data: plansData, isLoading, error, refetch } = useDataQuery(['admin-plans'], getPlans);
  const { isLoading: isAccessLoading } = usePageAccess();
  const { isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();
  
  // Edit plan dialog state
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  
  // Create plan dialog state
  const [createPlanDialogOpen, setCreatePlanDialogOpen] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    priceMonthly: '',
    priceYearly: '',
    yearlyDiscountRate: '',
    maxProperties: '',
    lotsLimit: '',
    usersLimit: '',
    extranetTenantsLimit: '',
    features: '{}',
    isActive: true,
    sortOrder: '',
  });

  // Create plan form state
  const [createFormData, setCreateFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    priceMonthly: '',
    priceYearly: '',
    yearlyDiscountRate: '',
    maxProperties: '',
    lotsLimit: '',
    usersLimit: '',
    extranetTenantsLimit: '',
    features: '{}',
    isActive: true,
    sortOrder: '0',
  });

  const plans = plansData?.plans || [];

  // Open edit dialog
  const openEditPlanDialog = (plan: any) => {
    setEditingPlan(plan);
    setFormData({
      displayName: plan.displayName || '',
      description: plan.description || '',
      priceMonthly: plan.priceMonthly !== null && plan.priceMonthly !== undefined ? plan.priceMonthly.toString() : '',
      priceYearly: plan.priceYearly !== null && plan.priceYearly !== undefined ? plan.priceYearly.toString() : '',
      yearlyDiscountRate: plan.yearlyDiscountRate !== null && plan.yearlyDiscountRate !== undefined ? plan.yearlyDiscountRate.toString() : '',
      maxProperties: plan.maxProperties !== null && plan.maxProperties !== undefined ? plan.maxProperties.toString() : '',
      lotsLimit: plan.lotsLimit !== null && plan.lotsLimit !== undefined ? plan.lotsLimit.toString() : '',
      usersLimit: plan.usersLimit !== null && plan.usersLimit !== undefined ? plan.usersLimit.toString() : '',
      extranetTenantsLimit: plan.extranetTenantsLimit !== null && plan.extranetTenantsLimit !== undefined ? plan.extranetTenantsLimit.toString() : '',
      features: plan.features ? JSON.stringify(plan.features, null, 2) : '{}',
      isActive: plan.isActive !== undefined ? plan.isActive : true,
      sortOrder: plan.sortOrder !== null && plan.sortOrder !== undefined ? plan.sortOrder.toString() : '',
    });
    setEditPlanDialogOpen(true);
  };

  // Handle creating plan
  const handleCreatePlan = async () => {
    if (!createFormData.name || !createFormData.displayName) {
      toast.error('Le nom (clé) et le nom d\'affichage sont requis');
      return;
    }

    setCreatingPlan(true);

    try {
      const planData: any = {
        name: createFormData.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        displayName: createFormData.displayName,
        description: createFormData.description || null,
        priceMonthly: createFormData.priceMonthly === '' ? null : parseFloat(createFormData.priceMonthly),
        priceYearly: createFormData.priceYearly === '' ? null : parseFloat(createFormData.priceYearly),
        yearlyDiscountRate: createFormData.yearlyDiscountRate === '' ? null : parseFloat(createFormData.yearlyDiscountRate),
        maxProperties: createFormData.maxProperties === '' ? null : parseInt(createFormData.maxProperties),
        lotsLimit: createFormData.lotsLimit === '' ? null : parseInt(createFormData.lotsLimit),
        usersLimit: createFormData.usersLimit === '' ? null : parseInt(createFormData.usersLimit),
        extranetTenantsLimit: createFormData.extranetTenantsLimit === '' ? null : parseInt(createFormData.extranetTenantsLimit),
        features: {},
        isActive: createFormData.isActive,
        sortOrder: createFormData.sortOrder === '' ? 0 : parseInt(createFormData.sortOrder),
      };

      if (createFormData.features) {
        try {
          planData.features = JSON.parse(createFormData.features);
        } catch (e) {
          toast.error('Format JSON invalide pour les fonctionnalités');
          return;
        }
      }

      await createPlan(planData);

      toast.success('Plan créé avec succès');
      setCreatePlanDialogOpen(false);
      setCreateFormData({
        name: '',
        displayName: '',
        description: '',
        priceMonthly: '',
        priceYearly: '',
        yearlyDiscountRate: '',
        maxProperties: '',
        lotsLimit: '',
        usersLimit: '',
        extranetTenantsLimit: '',
        features: '{}',
        isActive: true,
        sortOrder: '0',
      });
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la création');
    } finally {
      setCreatingPlan(false);
    }
  };

  // Handle saving plan
  const handleSavePlan = async () => {
    if (!editingPlan) return;

    setSavingPlan(true);

    try {
      const updates: any = {};
      
      if (formData.displayName) updates.displayName = formData.displayName;
      if (formData.description !== undefined) updates.description = formData.description || null;
      if (formData.priceMonthly !== '') {
        updates.priceMonthly = formData.priceMonthly === '' ? null : parseFloat(formData.priceMonthly);
      }
      if (formData.priceYearly !== '') {
        updates.priceYearly = formData.priceYearly === '' ? null : parseFloat(formData.priceYearly);
      }
      // Always include yearlyDiscountRate to allow setting it to null
      updates.yearlyDiscountRate = formData.yearlyDiscountRate === '' ? null : (formData.yearlyDiscountRate ? parseFloat(formData.yearlyDiscountRate) : null);
      if (formData.maxProperties !== '') {
        updates.maxProperties = formData.maxProperties === '' ? null : parseInt(formData.maxProperties);
      }
      if (formData.lotsLimit !== '') {
        updates.lotsLimit = formData.lotsLimit === '' ? null : parseInt(formData.lotsLimit);
      }
      if (formData.usersLimit !== '') {
        updates.usersLimit = formData.usersLimit === '' ? null : parseInt(formData.usersLimit);
      }
      if (formData.extranetTenantsLimit !== '') {
        updates.extranetTenantsLimit = formData.extranetTenantsLimit === '' ? null : parseInt(formData.extranetTenantsLimit);
      }
      if (formData.features) {
        try {
          updates.features = JSON.parse(formData.features);
        } catch (e) {
          toast.error('Format JSON invalide pour les fonctionnalités');
          return;
        }
      }
      if (formData.isActive !== undefined) updates.isActive = formData.isActive;
      if (formData.sortOrder !== '') {
        updates.sortOrder = formData.sortOrder === '' ? null : parseInt(formData.sortOrder);
      }

      await updatePlan(editingPlan.id, updates);

      toast.success('Plan mis à jour avec succès');
      setEditPlanDialogOpen(false);
      setEditingPlan(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la mise à jour');
    } finally {
      setSavingPlan(false);
    }
  };

  if (isAccessLoading || isLoading || isSuperAdminLoading) {
    return <PageLoader />;
  }

  // Check if user is super-admin
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-red-600 font-semibold mb-2">Accès refusé</p>
              <p className="text-muted-foreground text-sm">Seuls les super-administrateurs peuvent accéder à cette page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-red-600 font-semibold mb-2">Erreur lors du chargement</p>
              <p className="text-muted-foreground text-sm">{error.message}</p>
              <Button onClick={() => refetch()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Settings className="h-8 w-8 text-muted-foreground" />
                Gestion des Plans
              </h1>
              <p className="text-muted-foreground mt-2">
                Gérez les plans d'abonnement, leurs prix et leurs limites
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setCreatePlanDialogOpen(true)} 
                className="gap-2 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
              >
                <Plus className="h-4 w-4" />
                Créer un Plan
              </Button>
              <Button onClick={() => refetch()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </Button>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan: any) => (
              <Card key={plan.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditPlanDialog(plan)}
                      className="gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Éditer
                    </Button>
                  </div>
                  <CardDescription>{plan.description || plan.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Prices */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Prix mensuel:</span>
                      <span className="text-foreground">
                        {plan.priceMonthly !== null && plan.priceMonthly !== undefined
                          ? `${plan.priceMonthly.toLocaleString('fr-FR')} FCFA`
                          : 'Sur devis'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Prix annuel:</span>
                      <span className="text-foreground">
                        {plan.priceYearly !== null && plan.priceYearly !== undefined
                          ? `${plan.priceYearly.toLocaleString('fr-FR')} FCFA`
                          : 'Sur devis'}
                      </span>
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Propriétés:</span>
                      <span className="text-foreground">
                        {plan.maxProperties !== null && plan.maxProperties !== undefined
                          ? plan.maxProperties === -1
                            ? 'Illimité'
                            : plan.maxProperties
                          : 'Illimité'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Lots:</span>
                      <span className="text-foreground">
                        {plan.lotsLimit !== null && plan.lotsLimit !== undefined
                          ? plan.lotsLimit === -1
                            ? 'Illimité'
                            : plan.lotsLimit
                          : 'Illimité'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Utilisateurs:</span>
                      <span className="text-foreground">
                        {plan.usersLimit !== null && plan.usersLimit !== undefined
                          ? plan.usersLimit === -1
                            ? 'Illimité'
                            : plan.usersLimit
                          : 'Illimité'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Intranet locataires:</span>
                      <span className="text-foreground">
                        {plan.extranetTenantsLimit !== null && plan.extranetTenantsLimit !== undefined
                          ? plan.extranetTenantsLimit === -1
                            ? 'Illimité'
                            : plan.extranetTenantsLimit
                          : 'Illimité'}
                      </span>
                    </div>
                  </div>


                  {/* Status */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Statut:</span>
                      <span className={plan.isActive ? 'text-green-600' : 'text-muted-foreground'}>
                        {plan.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="font-medium">Ordre:</span>
                      <span className="text-muted-foreground">{plan.sortOrder || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Edit Plan Dialog */}
          <Dialog open={editPlanDialogOpen} onOpenChange={setEditPlanDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Éditer le Plan</DialogTitle>
                <DialogDescription>
                  {editingPlan && `Modifier les paramètres du plan ${editingPlan.displayName}`}
                </DialogDescription>
              </DialogHeader>

              {editingPlan && (
                <div className="space-y-4 mt-4">
                  {/* Plan Info */}
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Nom (clé):</span>
                      <span className="text-sm font-mono text-foreground">{editingPlan.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">ID:</span>
                      <span className="text-xs font-mono text-muted-foreground">{editingPlan.id}</span>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div className="space-y-2">
                    <Label htmlFor="display-name">
                      Nom d'affichage <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="display-name"
                      value={formData.displayName}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      disabled={savingPlan}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      disabled={savingPlan}
                      rows={3}
                    />
                  </div>

                  {/* Prices */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price-monthly">Prix mensuel (FCFA)</Label>
                      <Input
                        id="price-monthly"
                        type="number"
                        step="0.01"
                        placeholder="Sur devis (laisser vide)"
                        value={formData.priceMonthly}
                        onChange={(e) => setFormData(prev => ({ ...prev, priceMonthly: e.target.value }))}
                        disabled={savingPlan}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price-yearly">Prix annuel (FCFA)</Label>
                      <Input
                        id="price-yearly"
                        type="number"
                        step="0.01"
                        placeholder="Sur devis (laisser vide)"
                        value={formData.priceYearly}
                        onChange={(e) => setFormData(prev => ({ ...prev, priceYearly: e.target.value }))}
                        disabled={savingPlan}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearly-discount-rate">Taux de remise annuel (%)</Label>
                    <Input
                      id="yearly-discount-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="Ex: 20 pour 20% de remise"
                      value={formData.yearlyDiscountRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, yearlyDiscountRate: e.target.value }))}
                      disabled={savingPlan}
                    />
                    <p className="text-xs text-muted-foreground">
                      Si défini, le prix annuel sera calculé automatiquement : prix mensuel × 12 × (1 - taux/100)
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Laissez vide pour un prix sur devis
                  </p>

                  {/* Limits */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max-properties">Limite Propriétés</Label>
                      <Input
                        id="max-properties"
                        type="number"
                        placeholder="Illimité (laisser vide)"
                        value={formData.maxProperties}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxProperties: e.target.value }))}
                        disabled={savingPlan}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lots-limit">Limite Lots</Label>
                      <Input
                        id="lots-limit"
                        type="number"
                        placeholder="Illimité (laisser vide)"
                        value={formData.lotsLimit}
                        onChange={(e) => setFormData(prev => ({ ...prev, lotsLimit: e.target.value }))}
                        disabled={savingPlan}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="users-limit">Limite Utilisateurs</Label>
                      <Input
                        id="users-limit"
                        type="number"
                        placeholder="Illimité (laisser vide)"
                        value={formData.usersLimit}
                        onChange={(e) => setFormData(prev => ({ ...prev, usersLimit: e.target.value }))}
                        disabled={savingPlan}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="extranet-limit">Limite Intranet Locataires</Label>
                      <Input
                        id="extranet-limit"
                        type="number"
                        placeholder="Illimité (laisser vide)"
                        value={formData.extranetTenantsLimit}
                        onChange={(e) => setFormData(prev => ({ ...prev, extranetTenantsLimit: e.target.value }))}
                        disabled={savingPlan}
                      />
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-2">
                    <Label htmlFor="features">Fonctionnalités (JSON)</Label>
                    <Textarea
                      id="features"
                      value={formData.features}
                      onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                      disabled={savingPlan}
                      rows={8}
                      className="font-mono text-sm"
                      placeholder='{"dashboard": true, "properties_management": true, ...}'
                    />
                    <p className="text-xs text-muted-foreground">
                      Format JSON valide requis. Utilisez un objet JSON pour définir les fonctionnalités.
                    </p>
                  </div>

                  {/* Status and Sort Order */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="is-active" className="flex items-center justify-between">
                        <span>Plan actif</span>
                        <Switch
                          id="is-active"
                          checked={formData.isActive}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                          disabled={savingPlan}
                        />
                      </Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sort-order">Ordre d'affichage</Label>
                      <Input
                        id="sort-order"
                        type="number"
                        value={formData.sortOrder}
                        onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: e.target.value }))}
                        disabled={savingPlan}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSavePlan}
                      disabled={savingPlan || !formData.displayName}
                      className="flex-1 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
                    >
                      {savingPlan ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditPlanDialogOpen(false);
                        setEditingPlan(null);
                      }}
                      variant="outline"
                      disabled={savingPlan}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Create Plan Dialog */}
          <Dialog open={createPlanDialogOpen} onOpenChange={setCreatePlanDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer un Nouveau Plan</DialogTitle>
                <DialogDescription>
                  Créer un nouveau plan d'abonnement
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Plan Name (Key) */}
                <div className="space-y-2">
                  <Label htmlFor="create-plan-name">
                    Nom (clé) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="create-plan-name"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                    disabled={creatingPlan}
                    placeholder="ex: premium_plan"
                  />
                  <p className="text-xs text-muted-foreground">
                    Identifiant unique en minuscules (lettres, chiffres et underscores uniquement)
                  </p>
                </div>

                {/* Display Name */}
                <div className="space-y-2">
                  <Label htmlFor="create-display-name">
                    Nom d'affichage <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="create-display-name"
                    value={createFormData.displayName}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    disabled={creatingPlan}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="create-description">Description</Label>
                  <Textarea
                    id="create-description"
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                    disabled={creatingPlan}
                    rows={3}
                  />
                </div>

                {/* Prices */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-price-monthly">Prix mensuel (FCFA)</Label>
                    <Input
                      id="create-price-monthly"
                      type="number"
                      step="0.01"
                      placeholder="Sur devis (laisser vide)"
                      value={createFormData.priceMonthly}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, priceMonthly: e.target.value }))}
                      disabled={creatingPlan}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-price-yearly">Prix annuel (FCFA)</Label>
                    <Input
                      id="create-price-yearly"
                      type="number"
                      step="0.01"
                      placeholder="Sur devis (laisser vide)"
                      value={createFormData.priceYearly}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, priceYearly: e.target.value }))}
                      disabled={creatingPlan}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-yearly-discount-rate">Taux de remise annuel (%)</Label>
                  <Input
                    id="create-yearly-discount-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Ex: 20 pour 20% de remise"
                    value={createFormData.yearlyDiscountRate}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, yearlyDiscountRate: e.target.value }))}
                    disabled={creatingPlan}
                  />
                  <p className="text-xs text-muted-foreground">
                    Si défini, le prix annuel sera calculé automatiquement : prix mensuel × 12 × (1 - taux/100)
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour un prix sur devis
                </p>

                {/* Limits */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-max-properties">Limite Propriétés</Label>
                    <Input
                      id="create-max-properties"
                      type="number"
                      placeholder="Illimité (laisser vide)"
                      value={createFormData.maxProperties}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, maxProperties: e.target.value }))}
                      disabled={creatingPlan}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-lots-limit">Limite Lots</Label>
                    <Input
                      id="create-lots-limit"
                      type="number"
                      placeholder="Illimité (laisser vide)"
                      value={createFormData.lotsLimit}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, lotsLimit: e.target.value }))}
                      disabled={creatingPlan}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-users-limit">Limite Utilisateurs</Label>
                    <Input
                      id="create-users-limit"
                      type="number"
                      placeholder="Illimité (laisser vide)"
                      value={createFormData.usersLimit}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, usersLimit: e.target.value }))}
                      disabled={creatingPlan}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-extranet-limit">Limite Intranet Locataires</Label>
                    <Input
                      id="create-extranet-limit"
                      type="number"
                      placeholder="Illimité (laisser vide)"
                      value={createFormData.extranetTenantsLimit}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, extranetTenantsLimit: e.target.value }))}
                      disabled={creatingPlan}
                    />
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <Label htmlFor="create-features">Fonctionnalités (JSON)</Label>
                  <Textarea
                    id="create-features"
                    value={createFormData.features}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, features: e.target.value }))}
                    disabled={creatingPlan}
                    rows={8}
                    className="font-mono text-sm"
                    placeholder='{"dashboard": true, "properties_management": true, ...}'
                  />
                  <p className="text-xs text-muted-foreground">
                    Format JSON valide requis. Utilisez un objet JSON pour définir les fonctionnalités.
                  </p>
                </div>

                {/* Status and Sort Order */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-is-active" className="flex items-center justify-between">
                      <span>Plan actif</span>
                      <Switch
                        id="create-is-active"
                        checked={createFormData.isActive}
                        onCheckedChange={(checked) => setCreateFormData(prev => ({ ...prev, isActive: checked }))}
                        disabled={creatingPlan}
                      />
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-sort-order">Ordre d'affichage</Label>
                    <Input
                      id="create-sort-order"
                      type="number"
                      value={createFormData.sortOrder}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, sortOrder: e.target.value }))}
                      disabled={creatingPlan}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleCreatePlan}
                    disabled={creatingPlan || !createFormData.name || !createFormData.displayName}
                    className="flex-1 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
                  >
                    {creatingPlan ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Créer le Plan
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setCreatePlanDialogOpen(false);
                      setCreateFormData({
                        name: '',
                        displayName: '',
                        description: '',
                        priceMonthly: '',
                        priceYearly: '',
                        yearlyDiscountRate: '',
                        maxProperties: '',
                        lotsLimit: '',
                        usersLimit: '',
                        extranetTenantsLimit: '',
                        features: '{}',
                        isActive: true,
                        sortOrder: '0',
                      });
                    }}
                    variant="outline"
                    disabled={creatingPlan}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
  );
}

