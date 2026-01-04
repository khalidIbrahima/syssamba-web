'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Home, Loader2, ArrowLeft, Search, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { PhotoUpload } from '@/components/ui/photo-upload';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';

const unitFormSchema = z.object({
  unitNumber: z.string().min(1, 'Le numéro de lot est requis'),
  propertyId: z.string().min(1, 'Le bien est requis'),
  unitType: z.string().optional(), // Can be standard type or custom type slug
  floor: z.string().optional(),
  surface: z.number().int().min(1, 'La surface doit être au moins 1 m²').optional(),
  rentAmount: z.number().min(0, 'Le loyer doit être positif'),
  chargesAmount: z.number().min(0, 'Les charges doivent être positives'),
  depositAmount: z.number().min(0, 'La caution doit être positive'),
  status: z.enum(['vacant', 'occupied', 'maintenance', 'reserved']),
  photoUrls: z.array(z.string()).optional(),
});

type UnitFormValues = z.infer<typeof unitFormSchema>;

// Fetch properties for dropdown
async function getProperties() {
  const response = await fetch('/api/properties');
  if (!response.ok) {
    throw new Error('Failed to fetch properties');
  }
  return response.json();
}

// Fetch unit by ID
async function getUnit(id: string) {
  const response = await fetch(`/api/units/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch unit');
  }
  return response.json();
}

// Fetch custom unit types
async function getCustomUnitTypes() {
  const response = await fetch('/api/unit-types', {
    credentials: 'include',
  });
  if (!response.ok) {
    return { unitTypes: [] };
  }
  return response.json();
}

export default function EditUnitPage() {
  const router = useRouter();
  const params = useParams();
  const unitId = params.id as string;
  const { canAccessFeature, canAccessObject, isLoading: isAccessLoading } = useAccess();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [propertySearchOpen, setPropertySearchOpen] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState('');
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeSlug, setNewTypeSlug] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [isCreatingType, setIsCreatingType] = useState(false);

  const { data: properties, isLoading: propertiesLoading } = useDataQuery(
    ['properties'],
    getProperties
  );

  const { data: unit, isLoading: unitLoading } = useDataQuery(
    ['unit', unitId],
    () => getUnit(unitId)
  );

  const { data: customTypesData, refetch: refetchCustomTypes } = useDataQuery(
    ['custom-unit-types'],
    getCustomUnitTypes
  );

  const customUnitTypes = customTypesData?.unitTypes || [];

  // Standard unit types
  const standardTypes = [
    { value: 'studio', label: 'Studio' },
    { value: 'mini_studio', label: 'Mini Studio' },
    { value: 'f1', label: 'F1' },
    { value: 'f2', label: 'F2' },
    { value: 'f3', label: 'F3' },
    { value: 'f4', label: 'F4' },
    { value: 'f5', label: 'F5' },
    { value: 'f6', label: 'F6' },
    { value: 'duplex', label: 'Duplex' },
    { value: 'triplex', label: 'Triplex' },
    { value: 'villa', label: 'Villa' },
    { value: 'maison', label: 'Maison' },
    { value: 'appartement', label: 'Appartement' },
    { value: 'bureau', label: 'Bureau' },
    { value: 'commerce', label: 'Commerce' },
    { value: 'entrepot', label: 'Entrepôt' },
    { value: 'bureau_collectif', label: 'Bureau Collectif' },
    { value: 'atelier', label: 'Atelier' },
    { value: 'autre', label: 'Autre' },
  ];

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canAccessFeature('units_management', 'canEditUnits') &&
      !canAccessObject('Unit', 'edit')) {
    return (
      <AccessDenied
        featureName="Modification de lots"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      unitNumber: '',
      propertyId: '',
      unitType: undefined,
      floor: '',
      surface: undefined,
      rentAmount: 0,
      chargesAmount: 0,
      depositAmount: 0,
      status: 'vacant' as const,
      photoUrls: [],
    },
  });

  // Update form when unit data is loaded
  useEffect(() => {
    if (unit) {
      form.reset({
        unitNumber: unit.unitNumber || '',
        propertyId: unit.propertyId || '',
        unitType: unit.unitType || undefined,
        floor: unit.floor || '',
        surface: unit.surface || undefined,
        rentAmount: unit.rentAmount ? parseFloat(unit.rentAmount) : 0,
        chargesAmount: unit.chargesAmount ? parseFloat(unit.chargesAmount) : 0,
        depositAmount: unit.depositAmount ? parseFloat(unit.depositAmount) : 0,
        status: unit.status || 'vacant',
        photoUrls: unit.photoUrls || [],
      });
      setPhotos(unit.photoUrls || []);
    }
  }, [unit, form]);

  const handleCreateType = async () => {
    if (!newTypeName.trim() || !newTypeSlug.trim()) {
      toast.error('Le nom et le slug sont requis');
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9_-]+$/.test(newTypeSlug)) {
      toast.error('Le slug doit contenir uniquement des lettres minuscules, chiffres, tirets et underscores');
      return;
    }

    setIsCreatingType(true);
    try {
      const response = await fetch('/api/unit-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newTypeName.trim(),
          slug: newTypeSlug.trim(),
          description: newTypeDescription.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du type');
      }

      const newType = await response.json();
      toast.success('Type d\'unité créé avec succès !');
      
      // Reset form
      setNewTypeName('');
      setNewTypeSlug('');
      setNewTypeDescription('');
      setShowAddTypeDialog(false);
      
      // Refresh custom types
      refetchCustomTypes();
      
      // Set the new type as selected
      form.setValue('unitType', newType.slug);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du type');
    } finally {
      setIsCreatingType(false);
    }
  };

  const onSubmit = async (data: UnitFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/units/${unitId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          photoUrls: photos,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la modification du lot');
      }

      toast.success('Lot modifié avec succès!');
      router.push(`/units`);
    } catch (error: any) {
      console.error('Error updating unit:', error);
      toast.error(error.message || 'Erreur lors de la modification du lot');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (unitLoading || propertiesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/units">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Home className="h-8 w-8 text-blue-600" />
              Modifier le lot
            </h1>
            <p className="text-muted-foreground mt-1">
              Modifiez les informations du lot
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du lot</CardTitle>
          <CardDescription>
            Modifiez les informations du lot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Property Selection with Search */}
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => {
                  const selectedProperty = properties?.find((p: any) => p.id === field.value);
                  const currentProperty = unit?.property ? {
                    id: unit.property.id,
                    name: unit.property.name,
                    address: unit.property.address,
                  } : null;
                  
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Bien *</FormLabel>
                      <Popover open={propertySearchOpen} onOpenChange={setPropertySearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={propertiesLoading}
                              type="button"
                            >
                              {field.value && selectedProperty
                                ? `${selectedProperty.name} - ${selectedProperty.address}`
                                : "Rechercher un bien..."}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-2 border-b">
                            <Input
                              placeholder="Rechercher un bien..."
                              value={propertySearchQuery}
                              onChange={(e) => setPropertySearchQuery(e.target.value)}
                              className="mb-0"
                            />
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            {properties
                              ?.filter((property: any) => {
                                if (!propertySearchQuery.trim()) return true;
                                const searchLower = propertySearchQuery.toLowerCase();
                                const propertyLabel = `${property.name} - ${property.address}`;
                                return (
                                  propertyLabel.toLowerCase().includes(searchLower) ||
                                  property.name.toLowerCase().includes(searchLower) ||
                                  property.address.toLowerCase().includes(searchLower) ||
                                  (property.city && property.city.toLowerCase().includes(searchLower))
                                );
                              })
                              .map((property: any) => {
                                const propertyLabel = `${property.name} - ${property.address}`;
                                const isSelected = field.value === property.id;
                                
                                const handleSelect = (e: React.MouseEvent) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  field.onChange(property.id);
                                  setPropertySearchOpen(false);
                                  setPropertySearchQuery('');
                                };
                                
                                return (
                                  <div
                                    key={property.id}
                                    onClick={handleSelect}
                                    className={cn(
                                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                      isSelected && "bg-accent text-accent-foreground"
                                    )}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 shrink-0",
                                        isSelected ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium">{property.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {property.address}
                                        {property.city && `, ${property.city}`}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            {properties?.filter((property: any) => {
                              if (!propertySearchQuery.trim()) return true;
                              const searchLower = propertySearchQuery.toLowerCase();
                              const propertyLabel = `${property.name} - ${property.address}`;
                              return (
                                propertyLabel.toLowerCase().includes(searchLower) ||
                                property.name.toLowerCase().includes(searchLower) ||
                                property.address.toLowerCase().includes(searchLower) ||
                                (property.city && property.city.toLowerCase().includes(searchLower))
                              );
                            }).length === 0 && (
                              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                Aucun bien trouvé
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {currentProperty && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm font-medium text-blue-900">
                            Bien actuellement associé:
                          </p>
                          <p className="text-sm text-blue-700 mt-1">
                            {currentProperty.name} - {currentProperty.address}
                          </p>
                        </div>
                      )}
                      <FormDescription>
                        Bien immobilier auquel appartient ce lot
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Unit Number */}
              <FormField
                control={form.control}
                name="unitNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de lot *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: A101, B203, Villa"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Numéro ou identifiant unique du lot
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unit Type */}
              <FormField
                control={form.control}
                name="unitType"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Type d'unité</FormLabel>
                      {canAccessObject('Organization', 'edit') && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAddTypeDialog(true)}
                          className="h-7 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Ajouter un type
                        </Button>
                      )}
                    </div>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {standardTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                        {customUnitTypes.filter((ut: any) => ut.isActive).length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                              Types personnalisés
                            </div>
                            {customUnitTypes
                              .filter((ut: any) => ut.isActive)
                              .map((ut: any) => (
                                <SelectItem key={ut.slug} value={ut.slug}>
                                  {ut.name}
                                </SelectItem>
                              ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Type d'unité locative
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Floor */}
              <FormField
                control={form.control}
                name="floor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Étage</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: 1er étage, RDC, Sous-sol"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Surface */}
              <FormField
                control={form.control}
                name="surface"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface (m²)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 85"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Rent Amount */}
              <FormField
                control={form.control}
                name="rentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loyer mensuel (FCFA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ex: 450000"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : 0;
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Charges Amount */}
              <FormField
                control={form.control}
                name="chargesAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charges mensuelles (FCFA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ex: 50000"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : 0;
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Deposit Amount */}
              <FormField
                control={form.control}
                name="depositAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caution (FCFA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ex: 900000"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : 0;
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="vacant">Vacant</SelectItem>
                        <SelectItem value="occupied">Occupé</SelectItem>
                        <SelectItem value="maintenance">En maintenance</SelectItem>
                        <SelectItem value="reserved">Réservé</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Photos */}
              <FormItem>
                <PhotoUpload
                  photos={photos}
                  onChange={setPhotos}
                  maxPhotos={10}
                  label="Photos du lot"
                  description="Ajoutez jusqu'à 10 photos pour illustrer le lot"
                />
              </FormItem>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Modification...
                    </>
                  ) : (
                    <>
                      <Home className="h-4 w-4 mr-2" />
                      Enregistrer les modifications
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Add Unit Type Dialog */}
      <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un type d'unité</DialogTitle>
            <DialogDescription>
              Créez un nouveau type d'unité personnalisé pour votre organisation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type-name">Nom *</Label>
              <Input
                id="type-name"
                placeholder="Ex: Studio Luxe, F3 Rénové"
                value={newTypeName}
                onChange={(e) => {
                  setNewTypeName(e.target.value);
                  // Auto-generate slug from name
                  const slug = e.target.value
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                  setNewTypeSlug(slug);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-slug">Slug *</Label>
              <Input
                id="type-slug"
                placeholder="Ex: studio-luxe, f3-renove"
                value={newTypeSlug}
                onChange={(e) => setNewTypeSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Identifiant unique (lettres minuscules, chiffres, tirets et underscores uniquement)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-description">Description</Label>
              <Textarea
                id="type-description"
                placeholder="Description optionnelle du type d'unité"
                value={newTypeDescription}
                onChange={(e) => setNewTypeDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddTypeDialog(false);
                setNewTypeName('');
                setNewTypeSlug('');
                setNewTypeDescription('');
              }}
              disabled={isCreatingType}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateType} disabled={isCreatingType}>
              {isCreatingType ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer le type
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

