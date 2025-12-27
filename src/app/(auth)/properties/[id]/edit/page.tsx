'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Building2, Loader2, ArrowLeft, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PhotoUpload } from '@/components/ui/photo-upload';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import dynamic from 'next/dynamic';

// Dynamically import the map editor to avoid SSR issues
const PropertyMapEditor = dynamic(() => import('@/components/ui/property-map-editor').then(mod => ({ default: mod.PropertyMapEditor })), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">Chargement de la carte...</div>,
});

const propertyFormSchema = z.object({
  name: z.string().min(3, 'Le nom doit contenir au moins 3 caractères'),
  address: z.string().min(5, 'L\'adresse doit contenir au moins 5 caractères'),
  city: z.string().min(2, 'La ville doit contenir au moins 2 caractères'),
  propertyType: z.string().min(1, 'Le type de bien est requis'),
  totalUnits: z.number().int().min(1, 'Le nombre de lots doit être au moins 1').optional(),
  notes: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
  latitude: z.number().min(-90, 'La latitude doit être entre -90 et 90').max(90, 'La latitude doit être entre -90 et 90').optional().nullable(),
  longitude: z.number().min(-180, 'La longitude doit être entre -180 et 180').max(180, 'La longitude doit être entre -180 et 180').optional().nullable(),
});

type PropertyFormValues = z.infer<typeof propertyFormSchema>;

async function getProperty(id: string) {
  const response = await fetch(`/api/properties/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch property');
  }
  return response.json();
}

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;
  const { canAccessFeature, canAccessObject } = useAccess();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  const { data: property, isLoading } = useDataQuery(
    ['property', propertyId],
    () => getProperty(propertyId)
  );

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canAccessFeature('properties_management', 'canEditProperties') && 
      !canAccessObject('Property', 'edit')) {
    return (
      <AccessDenied
        featureName="Modification de biens"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      propertyType: '',
      totalUnits: undefined,
      notes: '',
      photoUrls: [],
      latitude: undefined,
      longitude: undefined,
    },
  });

  // Update form when property data is loaded
  useEffect(() => {
    if (property) {
      form.reset({
        name: property.name || '',
        address: property.address || '',
        city: property.city || '',
        propertyType: property.propertyType || '',
        totalUnits: property.totalUnits || undefined,
        notes: property.notes || '',
        photoUrls: property.photoUrls || [],
        latitude: property.latitude ? parseFloat(property.latitude) : undefined,
        longitude: property.longitude ? parseFloat(property.longitude) : undefined,
      });
      setPhotos(property.photoUrls || []);
    }
  }, [property, form]);

  const onSubmit = async (data: PropertyFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
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
        throw new Error(error.error || 'Erreur lors de la modification du bien');
      }

      toast.success('Bien modifié avec succès!');
      router.push(`/properties/${propertyId}`);
    } catch (error: any) {
      console.error('Error updating property:', error);
      toast.error(error.message || 'Erreur lors de la modification du bien');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
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
          <Link href={`/properties/${propertyId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              Modifier le bien
            </h1>
            <p className="text-gray-600 mt-1">
              Modifiez les informations du bien immobilier
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du bien</CardTitle>
          <CardDescription>
            Modifiez les informations du bien immobilier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du bien *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Résidence Les Almadies"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Nom unique pour identifier ce bien
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Route des Almadies, Dakar"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* City */}
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Dakar"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Geolocation Map */}
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Localisation du bien
                </FormLabel>
                <PropertyMapEditor
                  latitude={form.watch('latitude')}
                  longitude={form.watch('longitude')}
                  onLocationChange={(lat, lng) => {
                    form.setValue('latitude', lat);
                    form.setValue('longitude', lng);
                  }}
                />
                <FormDescription>
                  Cliquez sur la carte pour définir l'emplacement du bien. Vous pouvez également saisir les coordonnées manuellement ci-dessous.
                </FormDescription>
              </FormItem>

              {/* Geolocation Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Ex: 14.7167"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value ? parseFloat(e.target.value) : undefined;
                            field.onChange(value);
                          }}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Coordonnée GPS (entre -90 et 90)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Ex: -17.4677"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value ? parseFloat(e.target.value) : undefined;
                            field.onChange(value);
                          }}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Coordonnée GPS (entre -180 et 180)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Property Type */}
              <FormField
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de bien *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="residential_building">Immeuble résidentiel</SelectItem>
                        <SelectItem value="apartment_building">Immeuble d'appartements</SelectItem>
                        <SelectItem value="villa">Villa</SelectItem>
                        <SelectItem value="house">Maison</SelectItem>
                        <SelectItem value="commercial_building">Immeuble commercial</SelectItem>
                        <SelectItem value="mixed_use">Usage mixte</SelectItem>
                        <SelectItem value="land">Terrain</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Total Units */}
              <FormField
                control={form.control}
                name="totalUnits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de lots</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 12"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Nombre de lots/appartements dans ce bien
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informations supplémentaires sur le bien..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Informations complémentaires (optionnel)
                    </FormDescription>
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
                  label="Photos du bien"
                  description="Ajoutez jusqu'à 10 photos pour illustrer votre bien immobilier"
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
                      <Building2 className="h-4 w-4 mr-2" />
                      Enregistrer les modifications
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

