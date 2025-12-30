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
  
  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    priceMonthly: '',
    priceYearly: '',
    priceType: 'fixed' as 'fixed' | 'custom',
    lotsLimit: '',
    usersLimit: '',
    extranetTenantsLimit: '',
    isActive: true,
    sortOrder: '',
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
      priceType: plan.priceType || 'fixed',
      lotsLimit: plan.lotsLimit !== null && plan.lotsLimit !== undefined ? plan.lotsLimit.toString() : '',
      usersLimit: plan.usersLimit !== null && plan.usersLimit !== undefined ? plan.usersLimit.toString() : '',
      extranetTenantsLimit: plan.extranetTenantsLimit !== null && plan.extranetTenantsLimit !== undefined ? plan.extranetTenantsLimit.toString() : '',
      isActive: plan.isActive !== undefined ? plan.isActive : true,
      sortOrder: plan.sortOrder !== null && plan.sortOrder !== undefined ? plan.sortOrder.toString() : '',
    });
    setEditPlanDialogOpen(true);
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
      if (formData.priceType) updates.priceType = formData.priceType;
      if (formData.lotsLimit !== '') {
        updates.lotsLimit = formData.lotsLimit === '' ? null : parseInt(formData.lotsLimit);
      }
      if (formData.usersLimit !== '') {
        updates.usersLimit = formData.usersLimit === '' ? null : parseInt(formData.usersLimit);
      }
      if (formData.extranetTenantsLimit !== '') {
        updates.extranetTenantsLimit = formData.extranetTenantsLimit === '' ? null : parseInt(formData.extranetTenantsLimit);
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
              <p className="text-gray-600 text-sm">Seuls les super-administrateurs peuvent accéder à cette page.</p>
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
              <p className="text-gray-600 text-sm">{error.message}</p>
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
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Settings className="h-8 w-8 text-gray-700" />
                Gestion des Plans
              </h1>
              <p className="text-gray-600 mt-2">
                Gérez les plans d'abonnement, leurs prix et leurs limites
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
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
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Prix mensuel:</span>
                      <span className="text-gray-900">
                        {plan.priceMonthly !== null && plan.priceMonthly !== undefined
                          ? `${plan.priceMonthly.toLocaleString('fr-FR')} FCFA`
                          : 'Sur devis'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Prix annuel:</span>
                      <span className="text-gray-900">
                        {plan.priceYearly !== null && plan.priceYearly !== undefined
                          ? `${plan.priceYearly.toLocaleString('fr-FR')} FCFA`
                          : 'Sur devis'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Type: {plan.priceType === 'custom' ? 'Sur devis' : 'Fixe'}
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Home className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Lots:</span>
                      <span className="text-gray-900">
                        {plan.lotsLimit !== null && plan.lotsLimit !== undefined
                          ? plan.lotsLimit === -1
                            ? 'Illimité'
                            : plan.lotsLimit
                          : 'Illimité'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Utilisateurs:</span>
                      <span className="text-gray-900">
                        {plan.usersLimit !== null && plan.usersLimit !== undefined
                          ? plan.usersLimit === -1
                            ? 'Illimité'
                            : plan.usersLimit
                          : 'Illimité'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Intranet locataires:</span>
                      <span className="text-gray-900">
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
                      <span className={plan.isActive ? 'text-green-600' : 'text-gray-400'}>
                        {plan.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="font-medium">Ordre:</span>
                      <span className="text-gray-600">{plan.sortOrder || 0}</span>
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
                  <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Nom (clé):</span>
                      <span className="text-sm font-mono text-gray-900">{editingPlan.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">ID:</span>
                      <span className="text-xs font-mono text-gray-500">{editingPlan.id}</span>
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
                        placeholder="Sur devis (laisser vide)"
                        value={formData.priceYearly}
                        onChange={(e) => setFormData(prev => ({ ...prev, priceYearly: e.target.value }))}
                        disabled={savingPlan}
                      />
                    </div>
                  </div>

                  {/* Price Type */}
                  <div className="space-y-2">
                    <Label htmlFor="price-type">Type de prix</Label>
                    <select
                      id="price-type"
                      value={formData.priceType}
                      onChange={(e) => setFormData(prev => ({ ...prev, priceType: e.target.value as 'fixed' | 'custom' }))}
                      disabled={savingPlan}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="fixed">Fixe</option>
                      <option value="custom">Sur devis</option>
                    </select>
                  </div>

                  {/* Limits */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      className="flex-1 bg-gray-900 hover:bg-gray-800"
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
        </div>
  );
}

