'use client';

/**
 * Feature Gate Component
 * Conditionally renders children based on feature availability
 */

import React, { ReactNode } from 'react';
import { useFeatures } from '@/contexts/FeatureContext';
import { AlertCircle, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

/**
 * FeatureGate - Shows content only if feature is enabled
 * 
 * @example
 * <FeatureGate feature="advanced_analytics">
 *   <AnalyticsDashboard />
 * </FeatureGate>
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showUpgrade = false 
}: FeatureGateProps) {
  const { isFeatureEnabled, isLoading, plan } = useFeatures();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const enabled = isFeatureEnabled(feature);

  if (!enabled) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgrade) {
      return (
        <Card className="border-2 border-dashed">
          <CardContent className="p-8 text-center">
            <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Fonctionnalité Non Disponible
            </h3>
            <p className="text-gray-600 mb-4">
              Cette fonctionnalité n'est pas incluse dans votre plan {plan?.displayName}.
            </p>
            <Button variant="default">
              Mettre à niveau
            </Button>
          </CardContent>
        </Card>
      );
    }

    return null;
  }

  return <>{children}</>;
}

interface FeatureToggleProps {
  feature: string;
  enabled: ReactNode;
  disabled: ReactNode;
}

/**
 * FeatureToggle - Shows different content based on feature state
 * 
 * @example
 * <FeatureToggle 
 *   feature="advanced_analytics"
 *   enabled={<AdvancedCharts />}
 *   disabled={<BasicCharts />}
 * />
 */
export function FeatureToggle({ feature, enabled, disabled }: FeatureToggleProps) {
  const { isFeatureEnabled, isLoading } = useFeatures();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return isFeatureEnabled(feature) ? <>{enabled}</> : <>{disabled}</>;
}

interface FeatureLimitProps {
  feature: string;
  limitKey: string;
  children: (limit: any) => ReactNode;
}

/**
 * FeatureLimit - Provides limit values to children
 * 
 * @example
 * <FeatureLimit feature="property_management" limitKey="max_properties">
 *   {(maxProperties) => (
 *     <p>Vous pouvez créer jusqu'à {maxProperties} propriétés</p>
 *   )}
 * </FeatureLimit>
 */
export function FeatureLimit({ feature, limitKey, children }: FeatureLimitProps) {
  const { getFeatureLimit, isLoading } = useFeatures();

  if (isLoading) {
    return null;
  }

  const limit = getFeatureLimit(feature, limitKey);
  return <>{children(limit)}</>;
}

interface RequireFeatureProps {
  features: string[]; // Can require multiple features
  requireAll?: boolean; // If true, all features must be enabled. If false, at least one
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * RequireFeature - Shows content only if required features are enabled
 * 
 * @example
 * <RequireFeature features={["advanced_analytics", "api_access"]} requireAll>
 *   <ApiAnalyticsDashboard />
 * </RequireFeature>
 */
export function RequireFeature({ 
  features, 
  requireAll = true, 
  children, 
  fallback 
}: RequireFeatureProps) {
  const { isFeatureEnabled, isLoading } = useFeatures();

  if (isLoading) {
    return null;
  }

  const hasAccess = requireAll
    ? features.every((f) => isFeatureEnabled(f))
    : features.some((f) => isFeatureEnabled(f));

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

