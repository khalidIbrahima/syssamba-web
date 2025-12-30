'use client';

/**
 * Feature Gate Usage Examples
 * Demonstrates different ways to use the feature gating system
 */

import React from 'react';
import { FeatureGate, FeatureToggle, RequireFeature, FeatureLimit } from '../FeatureGate';
import { useFeatureCheck, useFeatureLimitCheck } from '@/hooks/use-feature-check';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

/**
 * Example 1: Simple Feature Gate
 * Hides content if feature is not enabled
 */
export function SimpleFeatureGateExample() {
  return (
    <FeatureGate feature="advanced_analytics">
      <Card>
        <CardHeader>
          <CardTitle>Analytiques Avancées</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Ce contenu n'est visible que si la fonctionnalité est activée</p>
        </CardContent>
      </Card>
    </FeatureGate>
  );
}

/**
 * Example 2: Feature Gate with Upgrade Message
 * Shows upgrade prompt if feature is not available
 */
export function UpgradePromptExample() {
  return (
    <FeatureGate feature="advanced_reporting" showUpgrade>
      <Card>
        <CardHeader>
          <CardTitle>Rapports Avancés</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Accès aux rapports détaillés et personnalisés</p>
        </CardContent>
      </Card>
    </FeatureGate>
  );
}

/**
 * Example 3: Feature Toggle
 * Shows different content based on feature availability
 */
export function FeatureToggleExample() {
  return (
    <FeatureToggle
      feature="premium_charts"
      enabled={
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle>Graphiques Premium</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Graphiques interactifs avec données en temps réel</p>
          </CardContent>
        </Card>
      }
      disabled={
        <Card className="border-gray-300">
          <CardHeader>
            <CardTitle>Graphiques Standards</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Graphiques de base avec données quotidiennes</p>
          </CardContent>
        </Card>
      }
    />
  );
}

/**
 * Example 4: Multiple Features Required
 * Requires all specified features to be enabled
 */
export function MultipleFeatureExample() {
  return (
    <RequireFeature 
      features={["advanced_analytics", "api_access"]} 
      requireAll
    >
      <Card>
        <CardHeader>
          <CardTitle>Tableau de Bord API Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Ce contenu nécessite les deux fonctionnalités activées</p>
        </CardContent>
      </Card>
    </RequireFeature>
  );
}

/**
 * Example 5: Feature Limits Display
 * Shows limit information to the user
 */
export function FeatureLimitDisplayExample() {
  return (
    <FeatureLimit feature="property_management" limitKey="max_properties">
      {(maxProperties) => (
        <Card>
          <CardHeader>
            <CardTitle>Limites du Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Nombre maximum de propriétés : <Badge>{maxProperties}</Badge></p>
          </CardContent>
        </Card>
      )}
    </FeatureLimit>
  );
}

/**
 * Example 6: Conditional Action with Hook
 * Uses hook to check feature before performing action
 */
export function ConditionalActionExample() {
  const { canAccess } = useFeatureCheck('bulk_operations');

  const handleBulkExport = () => {
    if (!canAccess) {
      toast.error('Cette fonctionnalité nécessite le plan Premium');
      return;
    }

    toast.success('Export en cours...');
    // Perform bulk export
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions Groupées</CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleBulkExport}
          disabled={!canAccess}
        >
          Export groupé {!canAccess && '(Premium)'}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Example 7: Limit Check Before Action
 * Prevents action if limit is reached
 */
export function LimitCheckExample({ currentCount = 5 }: { currentCount?: number }) {
  const { canAdd, remaining, limit } = useFeatureLimitCheck(
    'property_management',
    'max_properties',
    currentCount
  );

  const handleAddProperty = () => {
    if (!canAdd) {
      toast.error(`Limite atteinte : ${limit} propriétés maximum`);
      return;
    }

    toast.success('Ajout d\'une nouvelle propriété...');
    // Add property
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestion des Propriétés</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Propriétés restantes :</span>
          <Badge variant={remaining > 0 ? 'default' : 'destructive'}>
            {remaining} / {limit}
          </Badge>
        </div>
        <Button 
          onClick={handleAddProperty}
          disabled={!canAdd}
          className="w-full"
        >
          Ajouter une propriété
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Combined Example - Full Dashboard with Multiple Feature Gates
 */
export function FullDashboardExample() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Tableau de Bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Always visible */}
        <Card>
          <CardHeader>
            <CardTitle>Statistiques de Base</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Disponible pour tous les plans</p>
          </CardContent>
        </Card>

        {/* Conditional sections */}
        <SimpleFeatureGateExample />
        <FeatureToggleExample />
        <ConditionalActionExample />
        <LimitCheckExample />
      </div>

      {/* Premium section */}
      <UpgradePromptExample />
    </div>
  );
}

