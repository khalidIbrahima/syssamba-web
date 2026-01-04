'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  X,
  Grid3x3,
  List,
  Plus,
  Edit,
  Trash2,
  Navigation,
  Shield,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';

// Fetch navigation items data
async function getNavigationItems() {
  const response = await fetch('/api/admin/navigation-items', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch navigation items');
  }

  return response.json();
}

// Fetch all features for dropdown
async function getAllFeatures() {
  const response = await fetch('/api/admin/features', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch features');
  }

  const data = await response.json();
  return data.features || [];
}

// Update profile navigation item
async function updateProfileNavigationItem(
  profileId: string,
  navigationItemId: string,
  updates: { isEnabled?: boolean; isVisible?: boolean; customSortOrder?: number | null }
) {
  const response = await fetch('/api/admin/profile-navigation-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      profileId,
      navigationItemId,
      ...updates,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update profile navigation item');
  }

  return response.json();
}

// Create navigation item
async function createNavigationItem(data: any) {
  const response = await fetch('/api/admin/navigation-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create navigation item');
  }

  return response.json();
}

// Update navigation item
async function updateNavigationItem(key: string, data: any) {
  const response = await fetch('/api/admin/navigation-items', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ key, ...data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update navigation item');
  }

  return response.json();
}

// Delete navigation item
async function deleteNavigationItem(key: string) {
  const response = await fetch(`/api/admin/navigation-items?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete navigation item');
  }

  return response.json();
}

type ViewMode = 'matrix' | 'list';

interface NavigationItem {
  id: string;
  key: string;
  name: string;
  href: string;
  icon: string | null;
  badge_count: number | null;
  sort_order: number;
  feature_id: string | null;
  required_permission: string | null;
  required_object_type: string | null;
  required_object_action: string;
  parent_key: string | null;
  is_active: boolean;
  is_system_item: boolean;
  description: string | null;
}

interface Profile {
  id: string;
  name: string;
  display_name?: string;
  organization_id: string | null;
}

export default function NavigationItemsAdminPage() {
  const { data, isLoading, error, refetch } = useDataQuery(['navigation-items-admin'], getNavigationItems);
  const { data: allFeatures } = useDataQuery(['all-features'], getAllFeatures);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create/Edit dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NavigationItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    href: '',
    icon: '',
    badgeCount: null as number | null,
    sortOrder: 0,
    featureId: null as string | null,
    requiredPermission: '',
    requiredObjectType: '',
    requiredObjectAction: 'read' as 'read' | 'create' | 'edit' | 'delete',
    parentKey: null as string | null,
    isActive: true,
    isSystemItem: false,
    description: '',
  });

  const navigationItems: NavigationItem[] = data?.navigationItems || [];
  const profiles: Profile[] = data?.profiles || [];
  const profileNavItems = data?.profileNavigationItems || [];

  // Create a matrix: navigation items x profiles
  const itemMatrix = useMemo(() => {
    const matrix = new Map<string, {
      item: NavigationItem;
      profiles: Map<string, { isEnabled: boolean; isVisible: boolean; customSortOrder: number | null }>;
    }>();

    navigationItems.forEach((item) => {
      if (!matrix.has(item.key)) {
        matrix.set(item.key, {
          item,
          profiles: new Map(),
        });
      }

      const itemData = matrix.get(item.key)!;
      
      // Get profile associations for this item
      profileNavItems
        .filter((pni: any) => pni.navigation_item_id === item.id)
        .forEach((pni: any) => {
          itemData.profiles.set(pni.profile_id, {
            isEnabled: pni.is_enabled,
            isVisible: pni.is_visible,
            customSortOrder: pni.custom_sort_order,
          });
        });

      // Ensure all profiles have an entry (default to enabled/visible)
      profiles.forEach((profile) => {
        if (!itemData.profiles.has(profile.id)) {
          itemData.profiles.set(profile.id, {
            isEnabled: true,
            isVisible: true,
            customSortOrder: null,
          });
        }
      });
    });

    return matrix;
  }, [navigationItems, profiles, profileNavItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return Array.from(itemMatrix.values()).filter(({ item }) => {
      const matchesSearch = !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.href.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [itemMatrix, searchTerm]);

  // Group items by parent (for hierarchy)
  const groupedItems = useMemo(() => {
    const rootItems = filteredItems.filter(({ item }) => !item.parent_key);
    const childItems = filteredItems.filter(({ item }) => item.parent_key);
    
    return { rootItems, childItems };
  }, [filteredItems]);

  const handleProfileItemToggle = async (
    profileId: string,
    itemId: string,
    currentEnabled: boolean
  ) => {
    const updateKey = `${profileId}-${itemId}`;
    setUpdatingItems(prev => new Set(prev).add(updateKey));

    try {
      await updateProfileNavigationItem(profileId, itemId, {
        isEnabled: !currentEnabled,
      });
      toast.success(`Item ${!currentEnabled ? 'activé' : 'désactivé'} pour ce profil`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la mise à jour');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateKey);
        return newSet;
      });
    }
  };

  const handleCreate = async () => {
    if (!formData.key || !formData.name || !formData.href) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setCreating(true);

    try {
      await createNavigationItem({
        key: formData.key,
        name: formData.name,
        href: formData.href,
        icon: formData.icon || null,
        badgeCount: formData.badgeCount,
        sortOrder: formData.sortOrder,
        featureId: formData.featureId || null,
        requiredPermission: formData.requiredPermission || null,
        requiredObjectType: formData.requiredObjectType || null,
        requiredObjectAction: formData.requiredObjectAction,
        parentKey: formData.parentKey || null,
        isActive: formData.isActive,
        isSystemItem: formData.isSystemItem,
        description: formData.description || null,
      });

      toast.success('Item de navigation créé avec succès');
      setCreateDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (item: NavigationItem) => {
    setEditingItem(item);
    setFormData({
      key: item.key,
      name: item.name,
      href: item.href,
      icon: item.icon || '',
      badgeCount: item.badge_count,
      sortOrder: item.sort_order,
      featureId: item.feature_id,
      requiredPermission: item.required_permission || '',
      requiredObjectType: item.required_object_type || '',
      requiredObjectAction: item.required_object_action as any,
      parentKey: item.parent_key,
      isActive: item.is_active,
      isSystemItem: item.is_system_item,
      description: item.description || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    setSaving(true);

    try {
      await updateNavigationItem(editingItem.key, {
        name: formData.name,
        href: formData.href,
        icon: formData.icon || null,
        badgeCount: formData.badgeCount,
        sortOrder: formData.sortOrder,
        featureId: formData.featureId || null,
        requiredPermission: formData.requiredPermission || null,
        requiredObjectType: formData.requiredObjectType || null,
        requiredObjectAction: formData.requiredObjectAction,
        parentKey: formData.parentKey || null,
        isActive: formData.isActive,
        description: formData.description || null,
      });

      toast.success('Item de navigation mis à jour avec succès');
      setEditDialogOpen(false);
      setEditingItem(null);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: NavigationItem) => {
    if (item.is_system_item) {
      toast.error('Impossible de supprimer un item système');
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${item.name}" ?`)) {
      return;
    }

    try {
      await deleteNavigationItem(item.key);
      toast.success('Item de navigation supprimé avec succès');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      href: '',
      icon: '',
      badgeCount: null,
      sortOrder: 0,
      featureId: null,
      requiredPermission: '',
      requiredObjectType: '',
      requiredObjectAction: 'read',
      parentKey: null,
      isActive: true,
      isSystemItem: false,
      description: '',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground font-medium">Chargement...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <p className="text-red-600 font-semibold mb-2">Erreur lors du chargement</p>
                <p className="text-muted-foreground text-sm">{error.message}</p>
              </div>
              <Button onClick={() => refetch()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Navigation className="h-8 w-8 text-muted-foreground" />
            Gestion des Items de Navigation
          </h1>
          <p className="text-muted-foreground mt-2">
            Configurez les éléments de navigation disponibles pour chaque profil
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }} 
            variant="default" 
            className="gap-2 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Nouvel Item
          </Button>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Items de Navigation</p>
                <p className="text-3xl font-bold text-foreground mt-1">{navigationItems.length}</p>
              </div>
              <Navigation className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Profils</p>
                <p className="text-3xl font-bold text-foreground mt-1">{profiles.length}</p>
              </div>
              <Shield className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Résultats Filtrés</p>
                <p className="text-3xl font-bold text-foreground mt-1">{filteredItems.length}</p>
              </div>
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[250px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher des items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            {searchTerm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="matrix" className="gap-2">
            <Grid3x3 className="h-4 w-4" />
            Matrice
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Liste
          </TabsTrigger>
        </TabsList>

        {/* Matrix View */}
        <TabsContent value="matrix" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid3x3 className="h-5 w-5" />
                Matrice Items × Profils
              </CardTitle>
              <CardDescription>
                Vue d'ensemble complète • Cliquez sur les switches pour modifier les associations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted">
                      <th className="text-left p-4 font-semibold text-foreground sticky left-0 bg-muted z-10 min-w-[350px] border-r">
                        <div className="flex items-center gap-2">
                          <span>Item de Navigation</span>
                          <Badge variant="secondary" className="text-xs">
                            {filteredItems.length}
                          </Badge>
                        </div>
                      </th>
                      {profiles.map((profile) => (
                        <th key={profile.id} className="text-center p-4 min-w-[150px] border-l bg-muted">
                          <div className="font-semibold text-foreground">
                            {profile.display_name || profile.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={profiles.length + 1} className="p-8 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-3">
                            <Search className="h-12 w-12 text-muted-foreground" />
                            <p>Aucun item trouvé</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map(({ item, profiles: itemProfiles }, idx) => {
                        const updateKey = `${item.key}`;
                        const isSystem = item.is_system_item;

                        return (
                          <tr 
                            key={item.key} 
                            className={`border-b hover:bg-muted ${idx % 2 === 0 ? 'bg-background' : 'bg-muted'}`}
                          >
                            <td className="p-4 sticky left-0 bg-inherit border-r">
                              <div className="flex items-center justify-between">
                                <div className="space-y-2 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">{item.name}</span>
                                    {isSystem && (
                                      <Badge variant="secondary" className="text-xs">
                                        Système
                                      </Badge>
                                    )}
                                    {!item.is_active && (
                                      <Badge variant="outline" className="text-xs">
                                        Inactif
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">{item.key}</code>
                                    {' • '}
                                    <span>{item.href}</span>
                                  </div>
                                  {item.description && (
                                    <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
                                  )}
                                </div>
                                <div className="flex gap-1 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(item)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {!isSystem && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(item)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </td>
                            {profiles.map((profile) => {
                              const profileData = itemProfiles.get(profile.id);
                              const isEnabled = profileData?.isEnabled ?? true;
                              const updateKey = `${profile.id}-${item.key}`;
                              const isUpdating = updatingItems.has(updateKey);

                              return (
                                <td key={profile.id} className="p-4 text-center border-l">
                                  {isUpdating ? (
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                  ) : (
                                    <Switch
                                      checked={isEnabled}
                                      onCheckedChange={() => handleProfileItemToggle(profile.id, item.id, isEnabled)}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* List View */}
        <TabsContent value="list" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Liste des Items
              </CardTitle>
              <CardDescription>
                Vue détaillée de tous les items de navigation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p>Aucun item trouvé</p>
                  </div>
                ) : (
                  filteredItems.map(({ item }) => (
                    <Card key={item.key} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{item.name}</span>
                            {item.is_system_item && (
                              <Badge variant="secondary" className="text-xs">Système</Badge>
                            )}
                            {!item.is_active && (
                              <Badge variant="outline" className="text-xs">Inactif</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">{item.key}</code>
                            {' • '}
                            <span>{item.href}</span>
                            {item.icon && (
                              <>
                                {' • '}
                                <span>Icon: {item.icon}</span>
                              </>
                            )}
                          </div>
                          {item.description && (
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {item.feature_id && (
                              <Badge variant="outline" className="text-xs">
                                Feature: {allFeatures?.find((f: any) => f.id === item.feature_id)?.display_name || item.feature_id}
                              </Badge>
                            )}
                            {item.required_permission && (
                              <Badge variant="outline" className="text-xs">
                                Permission: {item.required_permission}
                              </Badge>
                            )}
                            {item.required_object_type && (
                              <Badge variant="outline" className="text-xs">
                                Object: {item.required_object_type}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!item.is_system_item && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un Item de Navigation</DialogTitle>
            <DialogDescription>
              Ajoutez un nouvel élément de navigation à la sidebar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="key">Clé (unique) *</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="dashboard"
                />
              </div>
              <div>
                <Label htmlFor="name">Nom d'affichage *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dashboard"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="href">Route (href) *</Label>
              <Input
                id="href"
                value={formData.href}
                onChange={(e) => setFormData({ ...formData, href: e.target.value })}
                placeholder="/dashboard"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="icon">Icône (Lucide)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="LayoutDashboard"
                />
              </div>
              <div>
                <Label htmlFor="sortOrder">Ordre d'affichage</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="featureId">Feature Requise (Plan)</Label>
              <Select
                value={formData.featureId || '__none__'}
                onValueChange={(value) => setFormData({ ...formData, featureId: value === '__none__' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une feature" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {allFeatures?.map((feature: any) => (
                    <SelectItem key={feature.id} value={feature.id}>
                      {feature.display_name || feature.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="requiredPermission">Permission Requise</Label>
                <Input
                  id="requiredPermission"
                  value={formData.requiredPermission}
                  onChange={(e) => setFormData({ ...formData, requiredPermission: e.target.value })}
                  placeholder="canViewAllProperties"
                />
              </div>
              <div>
                <Label htmlFor="requiredObjectType">Type d'Objet</Label>
                <Input
                  id="requiredObjectType"
                  value={formData.requiredObjectType}
                  onChange={(e) => setFormData({ ...formData, requiredObjectType: e.target.value })}
                  placeholder="Property"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de l'item..."
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Actif</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isSystemItem"
                  checked={formData.isSystemItem}
                  onCheckedChange={(checked) => setFormData({ ...formData, isSystemItem: checked })}
                />
                <Label htmlFor="isSystemItem">Item Système</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Création...
                </>
              ) : (
                'Créer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'Item de Navigation</DialogTitle>
            <DialogDescription>
              Modifiez les propriétés de l'item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-key">Clé (non modifiable)</Label>
                <Input
                  id="edit-key"
                  value={formData.key}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="edit-name">Nom d'affichage *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-href">Route (href) *</Label>
              <Input
                id="edit-href"
                value={formData.href}
                onChange={(e) => setFormData({ ...formData, href: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-icon">Icône (Lucide)</Label>
                <Input
                  id="edit-icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-sortOrder">Ordre d'affichage</Label>
                <Input
                  id="edit-sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-featureId">Feature Requise (Plan)</Label>
              <Select
                value={formData.featureId || '__none__'}
                onValueChange={(value) => setFormData({ ...formData, featureId: value === '__none__' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une feature" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {allFeatures?.map((feature: any) => (
                    <SelectItem key={feature.id} value={feature.id}>
                      {feature.display_name || feature.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-requiredPermission">Permission Requise</Label>
                <Input
                  id="edit-requiredPermission"
                  value={formData.requiredPermission}
                  onChange={(e) => setFormData({ ...formData, requiredPermission: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-requiredObjectType">Type d'Objet</Label>
                <Input
                  id="edit-requiredObjectType"
                  value={formData.requiredObjectType}
                  onChange={(e) => setFormData({ ...formData, requiredObjectType: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="edit-isActive">Actif</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

