'use client';

/**
 * Feature Gate Components - Rebuilt from scratch
 * Clean, performant, and user-friendly feature gating
 */

import React, { ReactNode, useMemo } from 'react';
import { useFeatures } from '@/contexts/FeatureContext';
import { AlertCircle, Lock, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// ============================================================================
// FeatureGate - Main component for conditional rendering
// ============================================================================

interface FeatureGateProps {
  feature: string; // Feature key (e.g., "task_management")
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
  upgradeHref?: string; // Optional link for upgrade button
  loadingComponent?: ReactNode; // Custom loading component
  errorComponent?: ReactNode; // Custom error component
}

/**
 * FeatureGate - Conditionally renders children based on feature availability
 * 
 * @example
 * <FeatureGate feature="task_management" showUpgrade>
 *   <TasksPage />
 * </FeatureGate>
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showUpgrade = false,
  upgradeHref = '/pricing',
  loadingComponent,
  errorComponent,
}: FeatureGateProps) {
  const { features, plan, isLoading, error } = useFeatures();


  // Loading state
  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Chargement des fonctionnalités...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-red-900 mb-1">
            Erreur de chargement
          </h3>
          <p className="text-xs text-red-700">
            Impossible de vérifier l'accès à cette fonctionnalité. Veuillez réessayer.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Match feature gate key with plan features
  // Check if the feature exists in the current plan's features and is enabled
  console.log('[FeatureGate] Looking for feature:', feature);
  console.log('[FeatureGate] Available features:', features.map(f => f.featureKey));
  console.log('[FeatureGate] Features count:', features.length);
  console.log('[FeatureGate] Plan:', plan);
  
  const planFeature = features.find(f => f.featureKey === feature);
  console.log('[FeatureGate] Found planFeature:', planFeature);
  const enabled = planFeature?.isEnabled ?? false;

  if (!enabled) {
    // Custom fallback
    if (fallback) {
      return <>{fallback}</>;
    }

    // Upgrade prompt
    if (showUpgrade) {
      return (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-8 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Fonctionnalité Non Disponible
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Cette fonctionnalité n'est pas incluse dans votre plan actuel{plan?.displayName ? ` (${plan.displayName})` : ''}.
              {planFeature && !planFeature.isEnabled && (
                <span className="block mt-2 text-sm text-muted-foreground">
                  La fonctionnalité existe dans votre plan mais n'est pas activée.
                </span>
              )}
              {!planFeature && plan?.displayName && (
                <span className="block mt-2 text-sm">
                  Mettez à niveau votre plan pour accéder à cette fonctionnalité.
                </span>
              )}
            </p>
            <Link href={upgradeHref}>
              <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
                Voir les plans
              </Button>
            </Link>
          </CardContent>
        </Card>
      );
    }

    // Default: render nothing
    return null;
  }

  // Feature is enabled - render children
  return <>{children}</>;
}

// ============================================================================
// FeatureToggle - Show different content based on feature state
// ============================================================================

interface FeatureToggleProps {
  feature: string;
  enabled: ReactNode;
  disabled: ReactNode;
  loading?: ReactNode;
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
export function FeatureToggle({ 
  feature, 
  enabled, 
  disabled,
  loading 
}: FeatureToggleProps) {
  const { isFeatureEnabled, isLoading } = useFeatures();

  if (isLoading) {
    return loading ? <>{loading}</> : null;
  }

  return isFeatureEnabled(feature) ? <>{enabled}</> : <>{disabled}</>;
}

// ============================================================================
// FeatureLimit - Provides limit values to children
// ============================================================================

interface FeatureLimitProps {
  feature: string;
  limitKey: string;
  children: (limit: number | string | boolean | null) => ReactNode;
  fallback?: ReactNode;
}

/**
 * FeatureLimit - Provides limit values to children via render prop
 * 
 * @example
 * <FeatureLimit feature="property_management" limitKey="max_properties">
 *   {(maxProperties) => (
 *     <p>Vous pouvez créer jusqu'à {maxProperties ?? 'illimité'} propriétés</p>
 *   )}
 * </FeatureLimit>
 */
export function FeatureLimit({ 
  feature, 
  limitKey, 
  children,
  fallback 
}: FeatureLimitProps) {
  const { getFeatureLimit, isLoading } = useFeatures();

  if (isLoading) {
    return fallback ? <>{fallback}</> : null;
  }

  const limit = getFeatureLimit(feature, limitKey);
  return <>{children(limit)}</>;
}

// ============================================================================
// RequireFeature - Multiple features with AND/OR logic
// ============================================================================

interface RequireFeatureProps {
  features: string[]; // Array of feature keys
  requireAll?: boolean; // true = AND (all required), false = OR (at least one)
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
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
  fallback,
  loading
}: RequireFeatureProps) {
  const { isFeatureEnabled, isLoading } = useFeatures();

  if (isLoading) {
    return loading ? <>{loading}</> : null;
  }

  const hasAccess = useMemo(() => {
    if (requireAll) {
      // All features must be enabled
      return features.every((f) => isFeatureEnabled(f));
    } else {
      // At least one feature must be enabled
      return features.some((f) => isFeatureEnabled(f));
    }
  }, [features, requireAll, isFeatureEnabled]);

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

// ============================================================================
// FeatureBadge - Visual indicator for feature availability
// ============================================================================

interface FeatureBadgeProps {
  feature: string;
  enabledLabel?: string;
  disabledLabel?: string;
  className?: string;
}

/**
 * FeatureBadge - Shows a badge indicating feature availability
 * 
 * @example
 * <FeatureBadge feature="premium_feature" />
 */
export function FeatureBadge({ 
  feature, 
  enabledLabel = 'Disponible',
  disabledLabel = 'Non disponible',
  className = ''
}: FeatureBadgeProps) {
  const { isFeatureEnabled, isLoading } = useFeatures();

  if (isLoading) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isFeatureEnabled(feature)
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-foreground'
      } ${className}`}
    >
      {isFeatureEnabled(feature) ? enabledLabel : disabledLabel}
    </span>
  );
}
