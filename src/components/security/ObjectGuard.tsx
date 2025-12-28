/**
 * ObjectGuard Component
 * Protects object actions based on all security levels
 */

'use client';

import { ReactNode } from 'react';
import { useSecurity } from '@/hooks/use-security';

interface ObjectGuardProps {
  objectType: string;
  action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll';
  objectId?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function ObjectGuard({
  objectType,
  action,
  objectId,
  fallback = null,
  children,
}: ObjectGuardProps) {
  const { canPerformAction, canAccessObject, isLoading, useObjectInstanceAccess } = useSecurity();

  if (isLoading) {
    return <>{fallback}</>;
  }

  // If checking a specific object instance, use instance-level security
  if (objectId) {
    const { allowed, isLoading: instanceLoading } = useObjectInstanceAccess(objectType, objectId, action);

    if (instanceLoading) {
      return <>{fallback}</>;
    }

    if (!allowed) {
      return <>{fallback}</>;
    }
  } else {
    // Check general object type access
    // Map 'viewAll' action to 'read' for canAccessObject check
    const mappedAction = action === 'viewAll' ? 'read' : action as 'read' | 'create' | 'edit' | 'delete';
    if (!canAccessObject(objectType, mappedAction)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

