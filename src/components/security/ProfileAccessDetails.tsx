/**
 * ProfileAccessDetails Component
 * Displays detailed profile access information
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProfileAccessLevel } from '@/hooks/use-profile-access-level';
import { getAccessLevelDescription } from '@/lib/security/profile-access-level';
import type { AccessLevel } from '@/lib/security/profile-access-level';
import { Shield, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const accessLevelColors: Record<AccessLevel, string> = {
  None: 'bg-gray-100 text-muted-foreground border-gray-300',
  Read: 'bg-blue-100 text-blue-700 border-blue-300',
  ReadWrite: 'bg-green-100 text-green-700 border-green-300',
  All: 'bg-purple-100 text-purple-700 border-purple-300',
};

export function ProfileAccessDetails() {
  const {
    profileName,
    overallAccessLevel,
    objectAccessLevels,
    canCreateAny,
    canEditAny,
    canDeleteAny,
    canViewAllAny,
    totalObjects,
    accessibleObjects,
    permissions,
    isLoading,
  } = useProfileAccessLevel();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Niveau d'accès du profil
            </CardTitle>
            <CardDescription>
              {profileName || 'Aucun profil assigné'}
            </CardDescription>
          </div>
          <Badge className={accessLevelColors[overallAccessLevel]}>
            {overallAccessLevel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Summary */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Résumé global
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              {canCreateAny ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Créer</span>
            </div>
            <div className="flex items-center gap-2">
              {canEditAny ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Modifier</span>
            </div>
            <div className="flex items-center gap-2">
              {canDeleteAny ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Supprimer</span>
            </div>
            <div className="flex items-center gap-2">
              {canViewAllAny ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Voir tout</span>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Statistiques
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {accessibleObjects}
              </div>
              <div className="text-sm text-muted-foreground">
                Objets accessibles sur {totalObjects}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {overallAccessLevel}
              </div>
              <div className="text-sm text-muted-foreground">
                {getAccessLevelDescription(overallAccessLevel)}
              </div>
            </div>
          </div>
        </div>

        {/* Object Access Levels */}
        {Object.keys(objectAccessLevels).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Accès par type d'objet
            </h3>
            <div className="space-y-2">
              {Object.entries(objectAccessLevels).map(([objectType, level]) => (
                <div
                  key={objectType}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    {objectType}
                  </span>
                  <Badge className={accessLevelColors[level]}>
                    {level}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Permissions */}
        {permissions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Permissions détaillées
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {permissions.map((permission) => (
                <div
                  key={permission.id}
                  className="p-3 rounded border bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {permission.objectType}
                    </span>
                    <Badge className={accessLevelColors[permission.accessLevel]}>
                      {permission.accessLevel}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      {permission.canRead ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span>Lire</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {permission.canCreate ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span>Créer</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {permission.canEdit ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span>Modifier</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {permission.canDelete ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span>Supprimer</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

