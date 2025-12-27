'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Users, Loader2, ArrowLeft, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const tenantFormSchema = z.object({
  unitId: z.string().min(1, 'Le lot est requis'),
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  idNumber: z.string().optional(),
  hasExtranetAccess: z.boolean(),
  language: z.enum(['fr', 'en', 'wo']),
});

type TenantFormValues = z.infer<typeof tenantFormSchema>;

// Fetch units for dropdown
async function getUnits() {
  const response = await fetch('/api/units');
  if (!response.ok) {
    throw new Error('Failed to fetch units');
  }
  return response.json();
}

function NewTenantPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unitIdParam = searchParams.get('unitId');
  const { canAccessFeature, canAccessObject } = useAccess();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unitSearchOpen, setUnitSearchOpen] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');

  const { data: units, isLoading: unitsLoading } = useDataQuery(
    ['units'],
    getUnits
  );

  // Filter only vacant units
  const availableUnits = units?.filter((unit: any) => unit.status === 'vacant') || [];

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canAccessFeature('tenants_basic', 'canCreateTenants') && 
      !canAccessObject('Tenant', 'create')) {
    return (
      <AccessDenied
        featureName="Création de locataires"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      unitId: unitIdParam || '',
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      idNumber: '',
      hasExtranetAccess: false,
      language: 'fr',
    },
  });

  const onSubmit = async (data: TenantFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du locataire');
      }

      const tenant = await response.json();
      toast.success('Locataire créé avec succès!');
      router.push('/tenants');
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      toast.error(error.message || 'Erreur lors de la création du locataire');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau locataire</h1>
          <p className="text-gray-600">Ajoutez un nouveau locataire à votre organisation</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/tenants">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du locataire</CardTitle>
          <CardDescription>
            Remplissez les informations de base du locataire
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Unit Selection with Search */}
              <FormField
                control={form.control}
                name="unitId"
                render={({ field }) => {
                  const selectedUnit = availableUnits.find((u: any) => u.id === field.value);
                  
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Lot *</FormLabel>
                      <Popover open={unitSearchOpen} onOpenChange={setUnitSearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={unitsLoading || availableUnits.length === 0}
                              type="button"
                            >
                              {field.value && selectedUnit
                                ? `${selectedUnit.unitNumber} - ${selectedUnit.propertyName}`
                                : "Rechercher un lot vacant..."}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-2 border-b">
                            <Input
                              placeholder="Rechercher un lot..."
                              value={unitSearchQuery}
                              onChange={(e) => setUnitSearchQuery(e.target.value)}
                              className="mb-0"
                            />
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            {availableUnits
                              .filter((unit: any) => {
                                if (!unitSearchQuery.trim()) return true;
                                const searchLower = unitSearchQuery.toLowerCase();
                                const unitLabel = `${unit.unitNumber} - ${unit.propertyName}`;
                                return (
                                  unitLabel.toLowerCase().includes(searchLower) ||
                                  unit.unitNumber.toLowerCase().includes(searchLower) ||
                                  unit.propertyName.toLowerCase().includes(searchLower)
                                );
                              })
                              .map((unit: any) => {
                                const unitLabel = `${unit.unitNumber} - ${unit.propertyName}`;
                                const isSelected = field.value === unit.id;
                                
                                const handleSelect = (e: React.MouseEvent) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  field.onChange(unit.id);
                                  setUnitSearchOpen(false);
                                  setUnitSearchQuery('');
                                };
                                
                                return (
                                  <div
                                    key={unit.id}
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
                                    <div className="flex items-center justify-between w-full">
                                      <span className="flex-1">
                                        {unit.unitNumber} - {unit.propertyName}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            {availableUnits.filter((unit: any) => {
                              if (!unitSearchQuery.trim()) return true;
                              const searchLower = unitSearchQuery.toLowerCase();
                              const unitLabel = `${unit.unitNumber} - ${unit.propertyName}`;
                              return (
                                unitLabel.toLowerCase().includes(searchLower) ||
                                unit.unitNumber.toLowerCase().includes(searchLower) ||
                                unit.propertyName.toLowerCase().includes(searchLower)
                              );
                            }).length === 0 && (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                {availableUnits.length === 0 
                                  ? "Aucun lot vacant disponible"
                                  : "Aucun lot trouvé."}
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Sélectionnez le lot que ce locataire occupera
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* First Name */}
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Fatou" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Last Name */}
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Diop" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: +221 77 123 45 67" {...field} />
                    </FormControl>
                    <FormDescription>
                      Numéro de téléphone au format international
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Ex: fatou.diop@gmail.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ID Number */}
              <FormField
                control={form.control}
                name="idNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro d'identification</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: SN123456789" {...field} />
                    </FormControl>
                    <FormDescription>
                      Numéro de pièce d'identité (CNI, passeport, etc.)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Language */}
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Langue</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="wo">Wolof</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Langue préférée pour les communications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Extranet Access */}
              <FormField
                control={form.control}
                name="hasExtranetAccess"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Accès extranet</FormLabel>
                      <FormDescription>
                        Permettre à ce locataire d'accéder à l'extranet pour consulter ses documents et paiements
                      </FormDescription>
                    </div>
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
                  disabled={isSubmitting || availableUnits.length === 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Créer le locataire
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

export default function NewTenantPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <NewTenantPageContent />
    </Suspense>
  );
}

