'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Shield,
  Save,
  CheckCircle2,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Plus,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/ui/access-denied';
import { useAccess } from '@/hooks/use-access';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

interface Profile {
  id: string;
  name: string;
  description: string | null;
  isSystemProfile: boolean;
  isActive: boolean;
}

interface ObjectPermission {
  id: string;
  objectType: ObjectType;
  accessLevel: 'None' | 'Read' | 'ReadWrite' | 'All';
  canCreate: boolean;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewAll: boolean;
}

interface FieldPermission {
  id: string;
  objectType: ObjectType;
  fieldName: string;
  accessLevel: 'None' | 'Read' | 'ReadWrite';
  canRead: boolean;
  canEdit: boolean;
  isSensitive: boolean;
}

const OBJECT_TYPES: ObjectType[] = [
  'Property',
  'Unit',
  'Tenant',
  'Profile',
  'Lease',
  'Payment',
  'Task',
  'Message',
  'JournalEntry',
  'User',
  'Organization',
  'Report',
  'Activity',
];

const ACCESS_LEVELS = [
  { value: 'None', label: 'Aucun accès', color: 'bg-gray-100 text-gray-800' },
  { value: 'Read', label: 'Lecture seule', color: 'bg-blue-100 text-blue-800' },
  { value: 'ReadWrite', label: 'Lecture/Écriture', color: 'bg-green-100 text-green-800' },
  { value: 'All', label: 'Accès complet', color: 'bg-purple-100 text-purple-800' },
];

// Fetch profile details
async function getProfile(profileId: string): Promise<Profile> {
  const response = await fetch(`/api/profiles/${profileId}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }
  return response.json();
}

// Fetch object permissions
async function getObjectPermissions(profileId: string): Promise<ObjectPermission[]> {
  const response = await fetch(`/api/profiles/${profileId}/object-permissions`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch object permissions');
  }
  return response.json();
}

// Fetch field permissions
async function getFieldPermissions(profileId: string): Promise<FieldPermission[]> {
  const response = await fetch(`/api/profiles/${profileId}/field-permissions`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch field permissions');
  }
  return response.json();
}

export default function ProfilePermissionsPage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const { canPerformAction, canAccessObject } = useAccess();
  const { isSuperAdmin } = useSuperAdmin();
  const [activeTab, setActiveTab] = useState('objects');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: profile, isLoading: profileLoading } = useDataQuery(
    ['profile', profileId],
    () => getProfile(profileId)
  );

  const { data: objectPermissions, isLoading: objectPermissionsLoading } = useDataQuery(
    ['profile-object-permissions', profileId],
    () => getObjectPermissions(profileId)
  );

  const { data: fieldPermissions, isLoading: fieldPermissionsLoading } = useDataQuery(
    ['profile-field-permissions', profileId],
    () => getFieldPermissions(profileId)
  );

  const [localObjectPermissions, setLocalObjectPermissions] = useState<Record<string, ObjectPermission>>({});
  const [localFieldPermissions, setLocalFieldPermissions] = useState<Record<string, FieldPermission>>({});

  // Initialize local state from fetched data
  useEffect(() => {
    if (objectPermissions) {
      const permissionsMap: Record<string, ObjectPermission> = {};
      objectPermissions.forEach((perm: ObjectPermission) => {
        permissionsMap[perm.objectType] = perm;
      });
      setLocalObjectPermissions(permissionsMap);
    }
  }, [objectPermissions]);

  useEffect(() => {
    if (fieldPermissions) {
      const permissionsMap: Record<string, FieldPermission> = {};
      fieldPermissions.forEach((perm: FieldPermission) => {
        const key = `${perm.objectType}:${perm.fieldName}`;
        permissionsMap[key] = perm;
      });
      setLocalFieldPermissions(permissionsMap);
    }
  }, [fieldPermissions]);

  // Check access: Super admin has full access, otherwise check permissions
  const isAdmin = canAccessObject('Organization', 'edit');
  const hasAccess = isSuperAdmin || isAdmin || canPerformAction('canViewSettings');
  
  if (!hasAccess) {
    return (
      <AccessDenied
        featureName="Gestion des permissions"
        requiredPermission="canViewSettings"
        icon="lock"
      />
    );
  }

  const handleAccessLevelChange = (objectType: ObjectType, accessLevel: 'None' | 'Read' | 'ReadWrite' | 'All') => {
    setLocalObjectPermissions((prev) => {
      const current = prev[objectType] || {
        id: '',
        objectType,
        accessLevel: 'None',
        canCreate: false,
        canRead: false,
        canEdit: false,
        canDelete: false,
        canViewAll: false,
      };

      let newPermission: ObjectPermission;
      switch (accessLevel) {
        case 'None':
          newPermission = {
            ...current,
            accessLevel: 'None',
            canCreate: false,
            canRead: false,
            canEdit: false,
            canDelete: false,
            canViewAll: false,
          };
          break;
        case 'Read':
          newPermission = {
            ...current,
            accessLevel: 'Read',
            canCreate: false,
            canRead: true,
            canEdit: false,
            canDelete: false,
            canViewAll: false,
          };
          break;
        case 'ReadWrite':
          newPermission = {
            ...current,
            accessLevel: 'ReadWrite',
            canCreate: true,
            canRead: true,
            canEdit: true,
            canDelete: false,
            canViewAll: false,
          };
          break;
        case 'All':
          newPermission = {
            ...current,
            accessLevel: 'All',
            canCreate: true,
            canRead: true,
            canEdit: true,
            canDelete: true,
            canViewAll: true,
          };
          break;
      }

      return { ...prev, [objectType]: newPermission };
    });
    setHasChanges(true);
  };

  const handlePermissionToggle = (
    objectType: ObjectType,
    permission: 'canCreate' | 'canRead' | 'canEdit' | 'canDelete' | 'canViewAll',
    value: boolean
  ) => {
    setLocalObjectPermissions((prev) => {
      const current = prev[objectType] || {
        id: '',
        objectType,
        accessLevel: 'None',
        canCreate: false,
        canRead: false,
        canEdit: false,
        canDelete: false,
        canViewAll: false,
      };

      const updated = { ...current, [permission]: value };
      
      // Auto-update access level based on permissions
      if (!updated.canRead && !updated.canCreate && !updated.canEdit && !updated.canDelete) {
        updated.accessLevel = 'None';
      } else if (updated.canRead && !updated.canCreate && !updated.canEdit && !updated.canDelete) {
        updated.accessLevel = 'Read';
      } else if (updated.canRead && updated.canCreate && updated.canEdit && !updated.canDelete && !updated.canViewAll) {
        updated.accessLevel = 'ReadWrite';
      } else if (updated.canRead && updated.canCreate && updated.canEdit && updated.canDelete && updated.canViewAll) {
        updated.accessLevel = 'All';
      } else {
        updated.accessLevel = 'ReadWrite'; // Custom combination
      }

      return { ...prev, [objectType]: updated };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save object permissions
      const objectPermsArray = Object.values(localObjectPermissions);
      const response = await fetch(`/api/profiles/${profileId}/object-permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permissions: objectPermsArray }),
      });

      if (!response.ok) {
        throw new Error('Failed to save object permissions');
      }

      toast.success('Permissions sauvegardées avec succès');
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (profileLoading || objectPermissionsLoading || fieldPermissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-red-600">
        Profil non trouvé
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/profiles')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Shield className="h-6 w-6 mr-2" />
              {profile.name}
            </h1>
            <p className="text-gray-600 mt-1">
              {profile.description || 'Gestion des permissions'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              Modifications non sauvegardées
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="objects">Permissions d'objet</TabsTrigger>
          <TabsTrigger value="fields">Permissions de champ</TabsTrigger>
        </TabsList>

        <TabsContent value="objects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permissions au niveau objet</CardTitle>
              <CardDescription>
                Configurez les permissions d'accès pour chaque type d'objet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type d'objet</TableHead>
                    <TableHead>Niveau d'accès</TableHead>
                    <TableHead>Créer</TableHead>
                    <TableHead>Lire</TableHead>
                    <TableHead>Modifier</TableHead>
                    <TableHead>Supprimer</TableHead>
                    <TableHead>Voir tout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {OBJECT_TYPES.map((objectType) => {
                    const permission = localObjectPermissions[objectType] || {
                      id: '',
                      objectType,
                      accessLevel: 'None',
                      canCreate: false,
                      canRead: false,
                      canEdit: false,
                      canDelete: false,
                      canViewAll: false,
                    };

                    return (
                      <TableRow key={objectType}>
                        <TableCell className="font-medium">{objectType}</TableCell>
                        <TableCell>
                          <Select
                            value={permission.accessLevel}
                            onValueChange={(value: 'None' | 'Read' | 'ReadWrite' | 'All') =>
                              handleAccessLevelChange(objectType, value)
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACCESS_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                  {level.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={permission.canCreate}
                            onCheckedChange={(checked) =>
                              handlePermissionToggle(objectType, 'canCreate', checked)
                            }
                            disabled={permission.accessLevel === 'None'}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={permission.canRead}
                            onCheckedChange={(checked) =>
                              handlePermissionToggle(objectType, 'canRead', checked)
                            }
                            disabled={permission.accessLevel === 'None'}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={permission.canEdit}
                            onCheckedChange={(checked) =>
                              handlePermissionToggle(objectType, 'canEdit', checked)
                            }
                            disabled={permission.accessLevel === 'None'}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={permission.canDelete}
                            onCheckedChange={(checked) =>
                              handlePermissionToggle(objectType, 'canDelete', checked)
                            }
                            disabled={permission.accessLevel === 'None' || permission.accessLevel === 'Read'}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={permission.canViewAll}
                            onCheckedChange={(checked) =>
                              handlePermissionToggle(objectType, 'canViewAll', checked)
                            }
                            disabled={permission.accessLevel === 'None' || !permission.canRead}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permissions au niveau champ</CardTitle>
              <CardDescription>
                Configurez les permissions d'accès pour les champs spécifiques
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                La gestion des permissions de champ sera disponible prochainement
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

