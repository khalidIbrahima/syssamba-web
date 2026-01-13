'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Home, Loader2, ArrowLeft, Search, Check, Wifi, Droplets, Shield, ArrowUp, Map, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';
import { usePlan } from '@/hooks/use-plan';
import { PhotoUpload } from '@/components/ui/photo-upload';
import { useDataQuery } from '@/hooks/use-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const unitFormSchema = z.object({
  unitNumber: z.string().min(1, 'Le numéro de lot est requis'),
  propertyId: z.string().min(1, 'Le bien est requis'),
  unitType: z.string().optional(), // Can be standard type or custom type slug
  floor: z.string().optional(),
  surface: z.number().int().min(1, 'La surface doit être au moins 1 m²').optional(),
  rentAmount: z.number().min(0, 'Le loyer doit être positif'),
  chargesAmount: z.number().min(0, 'Les charges doivent être positives'),
  depositAmount: z.number().min(0, 'La caution doit être positive'),
  salePrice: z.number().min(0, 'Le prix de vente doit être positif').optional(),
  status: z.enum(['vacant', 'occupied', 'maintenance', 'reserved', 'for_sale']),
  photoUrls: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
});

type UnitFormValues = z.infer<typeof unitFormSchema>;

// Fetch properties for dropdown
async function getProperties() {
  const response = await fetch('/api/properties', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch properties');
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
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

// Available amenities
const availableAmenities = [
  { id: 'wifi', label: 'Wifi gratuit', icon: Wifi },
  { id: 'piscine', label: 'Piscine', icon: Droplets },
  { id: 'salle_sport', label: 'Salle de sport', icon: Shield },
  { id: 'gardiennage', label: 'Gardiennage', icon: Shield },
  { id: 'ascenseur', label: 'Ascenseur', icon: ArrowUp },
  { id: 'jardin', label: 'Jardin', icon: Map },
];

function NewUnitPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyIdParam = searchParams.get('propertyId');
  const { canAccessFeature, canAccessObject, isLoading: isAccessLoading } = useAccess();
  const { isLotsLimitExceeded, limits, currentUsage } = usePlan();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [propertySearchOpen, setPropertySearchOpen] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState('');
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeSlug, setNewTypeSlug] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [isCreatingType, setIsCreatingType] = useState(false);
  const [showAddPropertyDialog, setShowAddPropertyDialog] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyAddress, setNewPropertyAddress] = useState('');
  const [newPropertyCity, setNewPropertyCity] = useState('');
  const [newPropertyType, setNewPropertyType] = useState('');
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);

  const { data: propertiesData, isLoading: propertiesLoading, refetch: refetchProperties } = useDataQuery(
    ['properties'],
    getProperties
  );
  
  // Ensure properties is always an array
  const properties = Array.isArray(propertiesData) ? propertiesData : [];

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

  const handleCreateProperty = async () => {
    if (!newPropertyName.trim() || !newPropertyAddress.trim() || !newPropertyCity.trim() || !newPropertyType.trim()) {
      toast.error('Tous les champs sont requis');
      return;
    }

    setIsCreatingProperty(true);
    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newPropertyName.trim(),
          address: newPropertyAddress.trim(),
          city: newPropertyCity.trim(),
          propertyType: newPropertyType.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du bien');
      }

      const newProperty = await response.json();
      toast.success('Bien créé avec succès !');
      
      // Reset form
      setNewPropertyName('');
      setNewPropertyAddress('');
      setNewPropertyCity('');
      setNewPropertyType('');
      setShowAddPropertyDialog(false);
      
      // Refresh properties list and wait for it to complete
      await refetchProperties();
      
      // Set the new property as selected after refresh
      form.setValue('propertyId', newProperty.id);
      setPropertySearchOpen(false);
      
      // Force form validation to show the selected property
      form.trigger('propertyId');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du bien');
    } finally {
      setIsCreatingProperty(false);
    }
  };

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canAccessFeature('units_management', 'canCreateUnits') &&
      !canAccessObject('Unit', 'create')) {
    return (
      <AccessDenied
        featureName="Création de lots"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }

  // Check if user can read properties
  const canReadProperties = canAccessObject('Property', 'read');

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      unitNumber: '',
      propertyId: propertyIdParam || '',
      unitType: undefined,
      floor: '',
      surface: undefined,
      rentAmount: 0,
      chargesAmount: 0,
      depositAmount: 0,
      status: 'vacant' as const,
      photoUrls: [],
      amenities: [],
    },
  });

  // Update form when propertyIdParam is available and properties are loaded
  useEffect(() => {
    if (propertyIdParam && properties.length > 0) {
      const propertyExists = properties.some((p: any) => p.id === propertyIdParam);
      if (propertyExists) {
        form.setValue('propertyId', propertyIdParam);
        form.trigger('propertyId'); // Trigger validation to show selected property
      }
    }
  }, [propertyIdParam, properties, form]);

  const onSubmit = async (data: UnitFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du lot');
      }

      const unit = await response.json();
      toast.success('Lot créé avec succès!');
      router.push(`/units`);
    } catch (error: any) {
      console.error('Error creating unit:', error);
      toast.error(error.message || 'Erreur lors de la création du lot');
    } finally {
      setIsSubmitting(false);
    }
  };

  const lotsRemaining = limits.lots === -1 ? Infinity : (limits.lots - currentUsage.lots);
  const canCreateMore = limits.lots === -1 || currentUsage.lots < limits.lots;

  return (
    <div className="space-y-6 min-h-screen bg-background">
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
              Créer un nouveau lot
            </h1>
            <p className="text-muted-foreground mt-1">
              Ajoutez un nouveau lot à votre portefeuille
            </p>
          </div>
        </div>
      </div>

      {/* Limit Warning */}
      {!canCreateMore && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Home className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-900">
                  Limite de lots atteinte
                </p>
                <p className="text-sm text-orange-700">
                  Vous avez atteint la limite de {limits.lots} lots de votre plan. 
                  <Link href="/pricing" className="underline ml-1">
                    Upgrader votre plan
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du lot</CardTitle>
          <CardDescription>
            Remplissez les informations de base du lot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 min-h-screen bg-background">
              {/* Property Selection with Search */}
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => {
                  const selectedProperty = properties?.find((p: any) => p.id === field.value);
                  const isPropertyPreSelected = !!propertyIdParam;
                  
                  return (
                    <FormItem className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <FormLabel>Bien *</FormLabel>
                        {!isPropertyPreSelected && canAccessObject('Property', 'create') && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddPropertyDialog(true)}
                            className="h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Créer un bien
                          </Button>
                        )}
                      </div>
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
                              disabled={propertiesLoading || !canReadProperties || isPropertyPreSelected}
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
                            {!canReadProperties ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                Vous n'avez pas la permission de voir les biens
                              </div>
                            ) : (() => {
                              const filteredProperties = properties.filter((property: any) => {
                                if (!propertySearchQuery.trim()) return true;
                                const searchLower = propertySearchQuery.toLowerCase();
                                const propertyName = (property.name || '').toLowerCase();
                                const propertyAddress = (property.address || '').toLowerCase();
                                const propertyCity = (property.city || '').toLowerCase();
                                return (
                                  propertyName.includes(searchLower) ||
                                  propertyAddress.includes(searchLower) ||
                                  propertyCity.includes(searchLower)
                                );
                              });

                              if (filteredProperties.length === 0) {
                                return (
                                  <div className="p-4 text-center text-sm text-muted-foreground">
                                    {properties.length === 0 
                                      ? "Aucun bien disponible"
                                      : "Aucun bien trouvé."}
                                  </div>
                                );
                              }

                              return filteredProperties.map((property: any) => {
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
                                    <div className="flex flex-col flex-1">
                                      <span className="font-medium">{property.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {property.address}{property.city ? `, ${property.city}` : ''}
                                      </span>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </PopoverContent>
                      </Popover>
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
                        {standardTypes.length > 0 && (
                          <>
                            {standardTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </>
                        )}
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
                      defaultValue={field.value}
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

              {/* Amenities & Services */}
              <FormField
                control={form.control}
                name="amenities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Équipements & Services</FormLabel>
                    <FormDescription>
                      Sélectionnez les équipements et services disponibles pour ce lot
                    </FormDescription>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      {availableAmenities.map((amenity) => {
                        const Icon = amenity.icon;
                        const isSelected = (field.value || []).includes(amenity.id);
                        
                        return (
                          <div
                            key={amenity.id}
                            onClick={() => {
                              const current = field.value || [];
                              const newValue = isSelected
                                ? current.filter((id) => id !== amenity.id)
                                : [...current, amenity.id];
                              field.onChange(newValue);
                            }}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                              isSelected
                                ? "border-blue-600 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                const newValue = checked
                                  ? [...current, amenity.id]
                                  : current.filter((id) => id !== amenity.id);
                                field.onChange(newValue);
                              }}
                            />
                            <Icon className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-medium">{amenity.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Photos */}
              <FormField
                control={form.control}
                name="photoUrls"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PhotoUpload
                        photos={field.value || []}
                        onChange={field.onChange}
                        maxPhotos={10}
                        label="Photos du lot"
                        description="Ajoutez jusqu'à 10 photos pour illustrer le lot"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                  disabled={isSubmitting || !canCreateMore}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Home className="h-4 w-4 mr-2" />
                      Créer le lot
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

      {/* Add Property Dialog */}
      <Dialog open={showAddPropertyDialog} onOpenChange={setShowAddPropertyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un bien</DialogTitle>
            <DialogDescription>
              Créez rapidement un nouveau bien immobilier
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="property-name">Nom du bien *</Label>
              <Input
                id="property-name"
                placeholder="Ex: Résidence Les Palmiers, Immeuble Alpha"
                value={newPropertyName}
                onChange={(e) => setNewPropertyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property-address">Adresse *</Label>
              <Input
                id="property-address"
                placeholder="Ex: Avenue Léopold Sédar Senghor"
                value={newPropertyAddress}
                onChange={(e) => setNewPropertyAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property-city">Ville *</Label>
              <Input
                id="property-city"
                placeholder="Ex: Dakar"
                value={newPropertyCity}
                onChange={(e) => setNewPropertyCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property-type">Type de bien *</Label>
              <Select value={newPropertyType} onValueChange={setNewPropertyType}>
                <SelectTrigger id="property-type">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Résidentiel</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="mixed">Mixte</SelectItem>
                  <SelectItem value="office">Bureaux</SelectItem>
                  <SelectItem value="industrial">Industriel</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddPropertyDialog(false);
                setNewPropertyName('');
                setNewPropertyAddress('');
                setNewPropertyCity('');
                setNewPropertyType('');
              }}
              disabled={isCreatingProperty}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateProperty} disabled={isCreatingProperty}>
              {isCreatingProperty ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer le bien
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NewUnitPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <NewUnitPageContent />
    </Suspense>
  );
}


