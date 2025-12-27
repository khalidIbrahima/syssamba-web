/**
 * FeatureGuard Component
 * Protects features based on plan and profile security
 */

'use client';

import { ReactNode } from 'react';
import { useSecurity } from '@/hooks/use-security';

interface FeatureGuardProps {
  featureKey: string;
  objectType?: string;
  requiredPermission?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGuard({
  featureKey,
  objectType,
  requiredPermission,
  fallback = null,
  children,
}: FeatureGuardProps) {
  const { canAccessFeature, isLoading } = useSecurity();

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!canAccessFeature(featureKey, objectType, requiredPermission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

