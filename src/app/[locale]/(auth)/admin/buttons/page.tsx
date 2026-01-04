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
  MousePointerClick,
  Shield,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';

// Fetch buttons data
async function getButtons() {
  const response = await fetch('/api/admin/buttons', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch buttons');
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

// Update profile button
async function updateProfileButton(
  profileId: string,
  buttonId: string,
  updates: { isEnabled?: boolean; isVisible?: boolean; customLabel?: string | null; customIcon?: string | null }
) {
  const response = await fetch('/api/admin/profile-buttons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      profileId,
      buttonId,
      ...updates,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update profile button');
  }

  return response.json();
}

// Create button
async function createButton(data: any) {
  const response = await fetch('/api/admin/buttons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create button');
  }

  return response.json();
}

// Update button
async function updateButton(id: string, data: any) {
  const response = await fetch('/api/admin/buttons', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ id, ...data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update button');
  }

  return response.json();
}

// Delete button
async function deleteButton(id: string) {
  const response = await fetch(`/api/admin/buttons?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete button');
  }

  return response.json();
}

// Sync buttons with object permissions
async function syncButtons(profileId?: string) {
  const response = await fetch('/api/admin/buttons/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(profileId ? { profileId } : {}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to sync buttons');
  }

  return response.json();
}

type ViewMode = 'matrix' | 'list';

interface Button {
  id: string;
  key: string;
  name: string;
  label: string;
  button_type: string;
  variant: string;
  size: string;
  object_type: string;
  action: string;
  icon: string | null;
  tooltip: string | null;
  sort_order: number;
  feature_id: string | null;
  required_permission: string | null;
  required_object_type: string | null;
  required_object_action: string;
  is_active: boolean;
  is_system_button: boolean;
  description: string | null;
  features?: { id: string; name: string; display_name: string } | null;
  profiles?: Array<{
    profileId: string;
    profileName: string;
    isEnabled: boolean;
    isVisible: boolean;
    customLabel: string | null;
    customIcon: string | null;
  }>;
}

interface Profile {
  id: string;
  name: string;
  display_name?: string;
}

export default function ButtonsManagementPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [objectTypeFilter, setObjectTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingButton, setEditingButton] = useState<Button | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data, isLoading, refetch } = useDataQuery(['admin-buttons'], getButtons);
  const { data: featuresData } = useDataQuery(['admin-features'], getAllFeatures);

  const buttons: Button[] = data?.buttons || [];
  const profiles: Profile[] = data?.profiles || [];
  const features = featuresData || [];

  // Filter buttons
  const filteredButtons = useMemo(() => {
    return buttons.filter((button) => {
      const matchesSearch =
        !searchQuery ||
        button.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        button.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        button.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        button.object_type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesObjectType = objectTypeFilter === 'all' || button.object_type === objectTypeFilter;
      const matchesAction = actionFilter === 'all' || button.action === actionFilter;
      return matchesSearch && matchesObjectType && matchesAction;
    });
  }, [buttons, searchQuery, objectTypeFilter, actionFilter]);

  // Get unique object types and actions
  const objectTypes = useMemo(() => {
    return Array.from(new Set(buttons.map((b) => b.object_type))).sort();
  }, [buttons]);

  const actions = useMemo(() => {
    return Array.from(new Set(buttons.map((b) => b.action))).sort();
  }, [buttons]);

  // Get button profile override
  const getButtonProfileOverride = (button: Button, profileId: string) => {
    return button.profiles?.find((p) => p.profileId === profileId);
  };

  // Handle profile button toggle
  const handleProfileButtonToggle = async (
    button: Button,
    profileId: string,
    field: 'isEnabled' | 'isVisible',
    value: boolean
  ) => {
    try {
      await updateProfileButton(profileId, button.id, { [field]: value });
      toast.success('Permission mise à jour avec succès');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  };

  // Handle sync
  const handleSync = async (profileId?: string) => {
    setIsSyncing(true);
    try {
      const result = await syncButtons(profileId);
      toast.success(
        profileId
          ? `Boutons synchronisés pour le profil (${result.syncedButtons} boutons)`
          : `Boutons synchronisés pour tous les profils (${result.syncedProfiles} profils, ${result.syncedButtons} boutons)`
      );
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la synchronisation');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle create button
  const handleCreateButton = async (formData: any) => {
    try {
      await createButton(formData);
      toast.success('Bouton créé avec succès');
      setIsCreateDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    }
  };

  // Handle update button
  const handleUpdateButton = async (id: string, formData: any) => {
    try {
      await updateButton(id, formData);
      toast.success('Bouton mis à jour avec succès');
      setIsEditDialogOpen(false);
      setEditingButton(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  };

  // Handle delete button
  const handleDeleteButton = async (button: Button) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le bouton "${button.name}" ?`)) {
      return;
    }

    try {
      await deleteButton(button.id);
      toast.success('Bouton supprimé avec succès');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6 min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des Boutons</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les boutons et leurs permissions par profil. Les permissions sont automatiquement synchronisées avec les permissions d'objet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSync()}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Synchroniser tous
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Créer un bouton
              </Button>
            </DialogTrigger>
            <CreateButtonDialog
              features={features}
              onSubmit={handleCreateButton}
              onClose={() => setIsCreateDialogOpen(false)}
            />
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un bouton..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={objectTypeFilter} onValueChange={setObjectTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type d'objet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les objets</SelectItem>
                {objectTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                {actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedProfile} onValueChange={setSelectedProfile}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Profil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les profils</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.display_name || profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'matrix' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('matrix')}
              >
                <Grid3x3 className="h-4 w-4 mr-2" />
                Matrice
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-2" />
                Liste
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buttons Matrix/List */}
      {viewMode === 'matrix' ? (
        <ButtonsMatrixView
          buttons={filteredButtons}
          profiles={profiles}
          selectedProfile={selectedProfile}
          onToggle={handleProfileButtonToggle}
          onEdit={(button) => {
            setEditingButton(button);
            setIsEditDialogOpen(true);
          }}
          onDelete={handleDeleteButton}
          onSync={handleSync}
        />
      ) : (
        <ButtonsListView
          buttons={filteredButtons}
          profiles={profiles}
          selectedProfile={selectedProfile}
          onToggle={handleProfileButtonToggle}
          onEdit={(button) => {
            setEditingButton(button);
            setIsEditDialogOpen(true);
          }}
          onDelete={handleDeleteButton}
        />
      )}

      {/* Edit Dialog */}
      {editingButton && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <EditButtonDialog
            button={editingButton}
            features={features}
            onSubmit={(data) => handleUpdateButton(editingButton.id, data)}
            onClose={() => {
              setIsEditDialogOpen(false);
              setEditingButton(null);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

// Matrix View Component
function ButtonsMatrixView({
  buttons,
  profiles,
  selectedProfile,
  onToggle,
  onEdit,
  onDelete,
  onSync,
}: {
  buttons: Button[];
  profiles: Profile[];
  selectedProfile: string;
  onToggle: (button: Button, profileId: string, field: 'isEnabled' | 'isVisible', value: boolean) => void;
  onEdit: (button: Button) => void;
  onDelete: (button: Button) => void;
  onSync: (profileId?: string) => void;
}) {
  const displayedProfiles = selectedProfile === 'all' ? profiles : profiles.filter((p) => p.id === selectedProfile);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matrice des Permissions</CardTitle>
        <CardDescription>
          Activez ou désactivez les boutons pour chaque profil. Les permissions sont synchronisées avec les permissions d'objet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold sticky left-0 bg-background z-10 min-w-[250px]">
                  Bouton
                </th>
                {displayedProfiles.map((profile) => (
                  <th key={profile.id} className="text-center p-3 font-semibold min-w-[150px]">
                    <div className="flex flex-col items-center gap-1">
                      <span>{profile.display_name || profile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSync(profile.id)}
                        className="h-6 text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Sync
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buttons.map((button) => (
                <tr key={button.id} className="border-b hover:bg-muted">
                  <td className="p-3 sticky left-0 bg-background z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{button.name}</span>
                          {button.is_system_button && (
                            <Badge variant="outline" className="text-xs">
                              Système
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {button.object_type} • {button.action}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{button.key}</div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(button)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        {!button.is_system_button && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(button)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </td>
                  {displayedProfiles.map((profile) => {
                    const override = button.profiles?.find((p) => p.profileId === profile.id);
                    const isEnabled = override?.isEnabled ?? false;
                    const isVisible = override?.isVisible ?? false;

                    return (
                      <td key={profile.id} className="p-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => onToggle(button, profile.id, 'isEnabled', checked)}
                            />
                            <span className="text-xs text-muted-foreground">Activé</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={isVisible}
                              onCheckedChange={(checked) => onToggle(button, profile.id, 'isVisible', checked)}
                            />
                            <span className="text-xs text-muted-foreground">Visible</span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// List View Component
function ButtonsListView({
  buttons,
  profiles,
  selectedProfile,
  onToggle,
  onEdit,
  onDelete,
}: {
  buttons: Button[];
  profiles: Profile[];
  selectedProfile: string;
  onToggle: (button: Button, profileId: string, field: 'isEnabled' | 'isVisible', value: boolean) => void;
  onEdit: (button: Button) => void;
  onDelete: (button: Button) => void;
}) {
  return (
    <div className="space-y-4">
      {buttons.map((button) => (
        <Card key={button.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">{button.name}</h3>
                  {button.is_system_button && (
                    <Badge variant="outline">Système</Badge>
                  )}
                  <Badge variant="secondary">{button.object_type}</Badge>
                  <Badge variant="outline">{button.action}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{button.label}</p>
                <p className="text-xs text-muted-foreground mb-4">Clé: {button.key}</p>
                {button.description && (
                  <p className="text-sm text-muted-foreground mb-4">{button.description}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(selectedProfile === 'all' ? profiles : profiles.filter((p) => p.id === selectedProfile)).map(
                    (profile) => {
                      const override = button.profiles?.find((p) => p.profileId === profile.id);
                      const isEnabled = override?.isEnabled ?? false;
                      const isVisible = override?.isVisible ?? false;

                      return (
                        <div key={profile.id} className="border rounded-lg p-3">
                          <div className="font-medium text-sm mb-2">{profile.display_name || profile.name}</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Activé</span>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => onToggle(button, profile.id, 'isEnabled', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Visible</span>
                              <Switch
                                checked={isVisible}
                                onCheckedChange={(checked) => onToggle(button, profile.id, 'isVisible', checked)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button variant="ghost" size="sm" onClick={() => onEdit(button)}>
                  <Edit className="h-4 w-4" />
                </Button>
                {!button.is_system_button && (
                  <Button variant="ghost" size="sm" onClick={() => onDelete(button)} className="text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Create Button Dialog
function CreateButtonDialog({
  features,
  onSubmit,
  onClose,
}: {
  features: Array<{ id: string; name: string; display_name: string }>;
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    label: '',
    buttonType: 'button',
    variant: 'default',
    size: 'default',
    objectType: '',
    action: 'create',
    icon: '',
    tooltip: '',
    sortOrder: 0,
    featureId: '',
    requiredPermission: '',
    requiredObjectType: '',
    requiredObjectAction: 'create',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      featureId: formData.featureId && formData.featureId !== '__none__' ? formData.featureId : null,
      requiredPermission: formData.requiredPermission || null,
      requiredObjectType: formData.requiredObjectType || null,
    });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Créer un nouveau bouton</DialogTitle>
        <DialogDescription>
          Créez un nouveau bouton qui sera disponible dans l'application.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="key">Clé *</Label>
            <Input
              id="key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="property.create"
              required
            />
          </div>
          <div>
            <Label htmlFor="name">Nom *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Créer un bien"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="label">Label *</Label>
          <Input
            id="label"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            placeholder="Créer"
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="buttonType">Type</Label>
            <Select
              value={formData.buttonType}
              onValueChange={(value) => setFormData({ ...formData, buttonType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="button">Button</SelectItem>
                <SelectItem value="icon">Icon</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="menu_item">Menu Item</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="variant">Variant</Label>
            <Select
              value={formData.variant}
              onValueChange={(value) => setFormData({ ...formData, variant: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="destructive">Destructive</SelectItem>
                <SelectItem value="outline">Outline</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
                <SelectItem value="ghost">Ghost</SelectItem>
                <SelectItem value="link">Link</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="size">Taille</Label>
            <Select
              value={formData.size}
              onValueChange={(value) => setFormData({ ...formData, size: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
                <SelectItem value="icon">Icon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="objectType">Type d'objet *</Label>
            <Select
              value={formData.objectType}
              onValueChange={(value) => setFormData({ ...formData, objectType: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type d'objet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Property">Property</SelectItem>
                <SelectItem value="Unit">Unit</SelectItem>
                <SelectItem value="Tenant">Tenant</SelectItem>
                <SelectItem value="Lease">Lease</SelectItem>
                <SelectItem value="Payment">Payment</SelectItem>
                <SelectItem value="JournalEntry">JournalEntry</SelectItem>
                <SelectItem value="Task">Task</SelectItem>
                <SelectItem value="Message">Message</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Organization">Organization</SelectItem>
                <SelectItem value="Profile">Profile</SelectItem>
                <SelectItem value="Report">Report</SelectItem>
                <SelectItem value="Activity">Activity</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Ou saisissez un type personnalisé dans le champ ci-dessous
            </p>
            <Input
              id="objectTypeCustom"
              value={formData.objectType}
              onChange={(e) => setFormData({ ...formData, objectType: e.target.value })}
              placeholder="Ou saisissez un type personnalisé"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="action">Action *</Label>
            <Select
              value={formData.action}
              onValueChange={(value) => setFormData({ ...formData, action: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="export">Export</SelectItem>
                <SelectItem value="import">Import</SelectItem>
                <SelectItem value="print">Print</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="icon">Icône</Label>
            <Input
              id="icon"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="Plus"
            />
          </div>
          <div>
            <Label htmlFor="tooltip">Tooltip</Label>
            <Input
              id="tooltip"
              value={formData.tooltip}
              onChange={(e) => setFormData({ ...formData, tooltip: e.target.value })}
              placeholder="Créer un nouveau bien"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="featureId">Feature</Label>
          <Select
            value={formData.featureId}
            onValueChange={(value) => setFormData({ ...formData, featureId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une feature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Aucune</SelectItem>
              {features.map((feature) => (
                <SelectItem key={feature.id} value={feature.id}>
                  {feature.display_name || feature.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit">Créer</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// Edit Button Dialog
function EditButtonDialog({
  button,
  features,
  onSubmit,
  onClose,
}: {
  button: Button;
  features: Array<{ id: string; name: string; display_name: string }>;
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    key: button.key,
    name: button.name,
    label: button.label,
    buttonType: button.button_type,
    variant: button.variant,
    size: button.size,
    objectType: button.object_type,
    action: button.action,
    icon: button.icon || '',
    tooltip: button.tooltip || '',
    sortOrder: button.sort_order,
    featureId: button.feature_id || '__none__',
    requiredPermission: button.required_permission || '',
    requiredObjectType: button.required_object_type || '',
    requiredObjectAction: button.required_object_action,
    description: button.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      featureId: formData.featureId && formData.featureId !== '__none__' ? formData.featureId : null,
      requiredPermission: formData.requiredPermission || null,
      requiredObjectType: formData.requiredObjectType || null,
    });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Modifier le bouton</DialogTitle>
        <DialogDescription>
          Modifiez les propriétés du bouton. Certaines modifications peuvent être limitées pour les boutons système.
        </DialogDescription>
      </DialogHeader>
      {button.is_system_button && (
        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-300 text-sm">
          <Info className="h-4 w-4 inline mr-1" />
          Ce bouton est un bouton système. Certaines modifications peuvent être limitées.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="edit-key">Clé *</Label>
            <Input
              id="edit-key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              required
              disabled={button.is_system_button}
            />
          </div>
          <div>
            <Label htmlFor="edit-name">Nom *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="edit-label">Label *</Label>
          <Input
            id="edit-label"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="edit-buttonType">Type</Label>
            <Select
              value={formData.buttonType}
              onValueChange={(value) => setFormData({ ...formData, buttonType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="button">Button</SelectItem>
                <SelectItem value="icon">Icon</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="menu_item">Menu Item</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-variant">Variant</Label>
            <Select
              value={formData.variant}
              onValueChange={(value) => setFormData({ ...formData, variant: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="destructive">Destructive</SelectItem>
                <SelectItem value="outline">Outline</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
                <SelectItem value="ghost">Ghost</SelectItem>
                <SelectItem value="link">Link</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-size">Taille</Label>
            <Select
              value={formData.size}
              onValueChange={(value) => setFormData({ ...formData, size: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
                <SelectItem value="icon">Icon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="edit-objectType">Type d'objet *</Label>
            <Input
              id="edit-objectType"
              value={formData.objectType}
              onChange={(e) => setFormData({ ...formData, objectType: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="edit-action">Action *</Label>
            <Select
              value={formData.action}
              onValueChange={(value) => setFormData({ ...formData, action: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="export">Export</SelectItem>
                <SelectItem value="import">Import</SelectItem>
                <SelectItem value="print">Print</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="edit-icon">Icône</Label>
            <Input
              id="edit-icon"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="edit-tooltip">Tooltip</Label>
            <Input
              id="edit-tooltip"
              value={formData.tooltip}
              onChange={(e) => setFormData({ ...formData, tooltip: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="edit-featureId">Feature</Label>
          <Select
            value={formData.featureId}
            onValueChange={(value) => setFormData({ ...formData, featureId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une feature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Aucune</SelectItem>
              {features.map((feature) => (
                <SelectItem key={feature.id} value={feature.id}>
                  {feature.display_name || feature.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit">Enregistrer</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

