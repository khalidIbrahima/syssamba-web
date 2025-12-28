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
  const { canPerformAction, canAccessObject, isLoading } = useSecurity();

  if (isLoading) {
    return <>{fallback}</>;
  }

  // Check object-level security using the appropriate method
  // Map 'viewAll' action to 'read' for canAccessObject check
  const mappedAction = action === 'viewAll' ? 'read' : action as 'read' | 'create' | 'edit' | 'delete';
  if (!canAccessObject(objectType, mappedAction)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

