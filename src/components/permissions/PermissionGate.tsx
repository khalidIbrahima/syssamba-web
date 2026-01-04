'use client';

/**
 * Permission Gate Component
 * Conditionally renders children based on user's profile permissions
 */

import React, { ReactNode } from 'react';
import { useProfilePermissions } from '@/contexts/ProfilePermissionsContext';
import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

interface PermissionGateProps {
  objectType: ObjectType;
  action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll';
  children: ReactNode;
  fallback?: ReactNode;
  showDenied?: boolean;
  deniedMessage?: string;
}

/**
 * PermissionGate - Shows content only if user has the required permission
 * 
 * @example
 * <PermissionGate objectType="Property" action="read">
 *   <PropertiesList />
 * </PermissionGate>
 */
export function PermissionGate({ 
  objectType, 
  action,
  children, 
  fallback,
  showDenied = false,
  deniedMessage,
}: PermissionGateProps) {
  const { canAccessObject, isLoading, profileName } = useProfilePermissions();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Organization admins (can edit Organization) bypass permission checks
  // They manage their own organization and should have full access
  const isOrgAdmin = canAccessObject('Organization', 'edit');
  const hasAccess = isOrgAdmin || canAccessObject(objectType, action);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showDenied) {
      const actionLabels: Record<string, string> = {
        read: 'lire',
        create: 'créer',
        edit: 'modifier',
        delete: 'supprimer',
        viewAll: 'voir tous',
      };

      return (
        <Card className="border-2 border-dashed">
          <CardContent className="p-8 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Accès Refusé
            </h3>
            <p className="text-muted-foreground mb-4">
              {deniedMessage || `Vous n'avez pas la permission de ${actionLabels[action] || action} les ${objectType}.`}
            </p>
            {profileName && (
              <p className="text-sm text-muted-foreground">
                Profil actuel: {profileName}
              </p>
            )}
          </CardContent>
        </Card>
      );
    }

    return null;
  }

  return <>{children}</>;
}

interface PermissionToggleProps {
  objectType: ObjectType;
  action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll';
  enabled: ReactNode;
  disabled: ReactNode;
}

/**
 * PermissionToggle - Shows different content based on permission state
 * 
 * @example
 * <PermissionToggle 
 *   objectType="Property"
 *   action="edit"
 *   enabled={<EditButton />}
 *   disabled={<ViewOnlyButton />}
 * />
 */
export function PermissionToggle({ objectType, action, enabled, disabled }: PermissionToggleProps) {
  const { canAccessObject, isLoading } = useProfilePermissions();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return canAccessObject(objectType, action) ? <>{enabled}</> : <>{disabled}</>;
}

interface RequirePermissionProps {
  objectTypes: ObjectType[]; // Can require multiple object types
  action: 'read' | 'create' | 'edit' | 'delete' | 'viewAll';
  requireAll?: boolean; // If true, all object types must have permission. If false, at least one
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * RequirePermission - Shows content only if required permissions are available
 * 
 * @example
 * <RequirePermission objectTypes={["Property", "Unit"]} action="read" requireAll>
 *   <PropertyAndUnitDashboard />
 * </RequirePermission>
 */
export function RequirePermission({ 
  objectTypes, 
  action,
  requireAll = true, 
  children, 
  fallback 
}: RequirePermissionProps) {
  const { canAccessObject, isLoading } = useProfilePermissions();

  if (isLoading) {
    return null;
  }

  const hasAccess = requireAll
    ? objectTypes.every((ot) => canAccessObject(ot, action))
    : objectTypes.some((ot) => canAccessObject(ot, action));

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

