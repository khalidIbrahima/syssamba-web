'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield,
  Plus,
  Search,
  Edit,
  Users,
  Settings,
  CheckCircle2,
  XCircle,
  Eye,
  Lock,
  Building2,
  Filter,
  LogOut,
  Grid3x3,
  List,
  Info,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/ui/access-denied';
import { useAccess } from '@/hooks/use-access';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { useAuth } from '@/hooks/use-auth';

interface Profile {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  organizationName?: string | null;
  isSystemProfile: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Organization {
  id: string;
  name: string | null;
}

// Fetch profiles from API
async function getProfiles(organizationId?: string | null, getAll?: boolean): Promise<Profile[]> {
  const params = new URLSearchParams();
  if (organizationId) {
    params.set('organizationId', organizationId);
  }
  if (getAll) {
    params.set('getAll', 'true');
  }
  
  const response = await fetch(`/api/profiles?${params.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch profiles');
  }
  return response.json();
}

// Fetch organizations for super admin
async function getOrganizations(): Promise<Organization[]> {
  const response = await fetch('/api/admin/organizations?limit=1000', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch organizations');
  }
  const data = await response.json();
  return data.organizations || [];
}

// Fetch permissions for a profile
async function getProfilePermissions(profileId: string) {
  const response = await fetch(`/api/admin/profiles/${profileId}/permissions`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch profile permissions');
  }
  const data = await response.json();
  return data.permissions || [];
}

interface ProfilePermission {
  id: string;
  profileId: string;
  objectType: string;
  accessLevel: 'None' | 'Read' | 'ReadWrite' | 'All';
  canCreate: boolean;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewAll: boolean;
}

export default function ProfilesPage() {
  const router = useRouter();
  const { canPerformAction, canAccessObject } = useAccess();
  const { isSuperAdmin } = useSuperAdmin();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/sign-in');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'permissions'>('list');
  const [permissionsData, setPermissionsData] = useState<Record<string, ProfilePermission[]>>({});
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

  // Fetch organizations for super admin
  const { data: organizations } = useDataQuery(
    ['admin-organizations'],
    getOrganizations,
    { enabled: !!isSuperAdmin }
  );

  // Fetch profiles with filter
  const { data: profiles, isLoading, error, refetch } = useDataQuery(
    ['profiles', selectedOrganizationId || 'all', showAll.toString()],
    () => getProfiles(selectedOrganizationId, showAll && !!isSuperAdmin)
  );

  // Fetch permissions for all profiles when in permissions view
  useEffect(() => {
    if (viewMode === 'permissions' && profiles && profiles.length > 0) {
      setIsLoadingPermissions(true);
      Promise.all(
        profiles.map(async (profile: Profile) => {
          try {
            const permissions = await getProfilePermissions(profile.id);
            return { profileId: profile.id, permissions };
          } catch (error) {
            console.error(`Error fetching permissions for profile ${profile.id}:`, error);
            return { profileId: profile.id, permissions: [] };
          }
        })
      ).then((results) => {
        const permissionsMap: Record<string, ProfilePermission[]> = {};
        results.forEach(({ profileId, permissions }) => {
          permissionsMap[profileId] = permissions;
        });
        setPermissionsData(permissionsMap);
        setIsLoadingPermissions(false);
      });
    }
  }, [viewMode, profiles]);

  // Check access: Super admin OR can edit Profile object OR canViewSettings
  const canEditProfile = canAccessObject('Profile', 'edit');
  const canViewSettings = canPerformAction('canViewSettings');
  const hasAccess = isSuperAdmin || canEditProfile || canViewSettings;

  if (!hasAccess) {
    return (
      <AccessDenied
        featureName="Gestion des profils"
        requiredPermission="canViewSettings ou Profile (edit)"
        icon="lock"
      />
    );
  }

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error('Le nom du profil est requis');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newProfileName.trim(),
          description: newProfileDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la création du profil');
      }

      toast.success('Profil créé avec succès');
      setIsCreateDialogOpen(false);
      setNewProfileName('');
      setNewProfileDescription('');
      refetch();
    } catch (error: any) {
      console.error('Error creating profile:', error);
      toast.error(error.message || 'Erreur lors de la création du profil');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredProfiles = profiles?.filter((profile: Profile) =>
    profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="h-6 w-6 mr-2" />
            Gestion des profils
          </h1>
          <p className="text-gray-600 mt-1">
            Configurez les permissions et accès pour chaque profil utilisateur
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau profil
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un nouveau profil</DialogTitle>
              <DialogDescription>
                Créez un nouveau profil avec des permissions personnalisées
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="profile-name">Nom du profil *</Label>
                <Input
                  id="profile-name"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Ex: Gestionnaire"
                />
              </div>
              <div>
                <Label htmlFor="profile-description">Description</Label>
                <Textarea
                  id="profile-description"
                  value={newProfileDescription}
                  onChange={(e) => setNewProfileDescription(e.target.value)}
                  placeholder="Description du profil..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreateProfile}
                disabled={isCreating || !newProfileName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isCreating ? 'Création...' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Profils disponibles</CardTitle>
                <CardDescription>
                  {profiles?.length || 0} profil(s) configuré(s)
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Rechercher un profil..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={viewMode === 'list' ? 'bg-white shadow-sm' : ''}
                  >
                    <List className="h-4 w-4 mr-2" />
                    Liste
                  </Button>
                  <Button
                    variant={viewMode === 'permissions' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('permissions')}
                    className={viewMode === 'permissions' ? 'bg-white shadow-sm' : ''}
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    Permissions
                  </Button>
                </div>
              </div>
            </div>
            {isSuperAdmin && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Label className="text-sm font-medium">Filtrer par organisation:</Label>
                </div>
                <Select
                  value={showAll ? 'all' : selectedOrganizationId || 'all'}
                  onValueChange={(value) => {
                    if (value === 'all') {
                      setShowAll(true);
                      setSelectedOrganizationId(null);
                    } else {
                      setShowAll(false);
                      setSelectedOrganizationId(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Toutes les organisations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les organisations</SelectItem>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name || `Organisation ${org.id.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              Erreur lors du chargement des profils
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchQuery ? 'Aucun profil trouvé' : 'Aucun profil configuré'}
            </div>
          ) : viewMode === 'list' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Description</TableHead>
                  {isSuperAdmin && <TableHead>Organisation</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((profile: Profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 mr-2 text-gray-400" />
                        {profile.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {profile.description || '-'}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        {profile.organizationId ? (
                          <div className="flex items-center">
                            <Building2 className="h-3 w-3 mr-1 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {profile.organizationName || `Org ${profile.organizationId.slice(0, 8)}`}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            Global
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      {profile.isSystemProfile ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Système
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          Personnalisé
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {profile.isActive ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Actif
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/profiles/${profile.id}`)}
                          className="flex items-center"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Permissions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/profiles/${profile.id}`)}
                          className="flex items-center"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Modifier
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            // Permissions Matrix View
            <div className="space-y-4">
              {isLoadingPermissions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Chargement des permissions...</span>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                              Profil / Objet
                            </th>
                            {['Property', 'Unit', 'Tenant', 'Lease', 'Payment', 'Task', 'Message', 'JournalEntry', 'User', 'Organization', 'Profile'].map((objectType) => (
                              <th key={objectType} className="px-3 py-3 text-center text-xs font-medium text-gray-700 min-w-[100px]">
                                {objectType}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredProfiles.map((profile: Profile) => {
                            const permissions = permissionsData[profile.id] || [];
                            const permissionsMap = new Map(permissions.map(p => [p.objectType, p]));
                            
                            return (
                              <tr key={profile.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-gray-400" />
                                    <div>
                                      <div className="font-medium text-sm text-gray-900">{profile.name}</div>
                                      {profile.description && (
                                        <div className="text-xs text-gray-500">{profile.description}</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {['Property', 'Unit', 'Tenant', 'Lease', 'Payment', 'Task', 'Message', 'JournalEntry', 'User', 'Organization', 'Profile'].map((objectType) => {
                                  const perm = permissionsMap.get(objectType);
                                  if (!perm) {
                                    return (
                                      <td key={objectType} className="px-3 py-3 text-center">
                                        <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                                          None
                                        </Badge>
                                      </td>
                                    );
                                  }
                                  
                                  const getAccessLevelBadge = (level: string) => {
                                    switch (level) {
                                      case 'All':
                                        return <Badge className="bg-green-100 text-green-800 border-green-200">All</Badge>;
                                      case 'ReadWrite':
                                        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">RW</Badge>;
                                      case 'Read':
                                        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">R</Badge>;
                                      case 'None':
                                        return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">None</Badge>;
                                      default:
                                        return <Badge variant="outline">{level}</Badge>;
                                    }
                                  };
                                  
                                  return (
                                    <td key={objectType} className="px-3 py-3 text-center">
                                      <div className="flex flex-col items-center gap-1">
                                        {getAccessLevelBadge(perm.accessLevel)}
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                          {perm.canCreate && <span className="text-green-600" title="Create">C</span>}
                                          {perm.canRead && <span className="text-blue-600" title="Read">R</span>}
                                          {perm.canEdit && <span className="text-orange-600" title="Edit">E</span>}
                                          {perm.canDelete && <span className="text-red-600" title="Delete">D</span>}
                                          {perm.canViewAll && <span className="text-purple-600" title="View All">V</span>}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center gap-6 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Légende:</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Badge className="bg-green-100 text-green-800 border-green-200">All</Badge>
                        <span>Accès complet</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">RW</Badge>
                        <span>Lecture/Écriture</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">R</Badge>
                        <span>Lecture seule</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-green-600 font-semibold">C</span>
                        <span>Create</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-600 font-semibold">R</span>
                        <span>Read</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-orange-600 font-semibold">E</span>
                        <span>Edit</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-red-600 font-semibold">D</span>
                        <span>Delete</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-purple-600 font-semibold">V</span>
                        <span>View All</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
