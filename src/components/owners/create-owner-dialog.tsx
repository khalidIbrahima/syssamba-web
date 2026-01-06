'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { useDataQuery } from '@/hooks/use-query';
import { cn } from '@/lib/utils';

const createOwnerSchema = z.object({
  propertyId: z.string().optional(),
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  commissionRate: z.number().min(0).max(100),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

type CreateOwnerFormValues = z.infer<typeof createOwnerSchema>;

interface CreateOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Fetch properties for the dropdown
async function getProperties() {
  const response = await fetch('/api/properties', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch properties');
  }
  const data = await response.json();
  return data;
}

export function CreateOwnerDialog({ open, onOpenChange, onSuccess }: CreateOwnerDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [propertyPopoverOpen, setPropertyPopoverOpen] = useState(false);
  const { data: properties = [] } = useDataQuery(['properties'], getProperties);

  const form = useForm<CreateOwnerFormValues>({
    resolver: zodResolver(createOwnerSchema),
    defaultValues: {
      propertyId: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      bankAccount: '',
      bankName: '',
      commissionRate: 20,
      isActive: true,
      notes: '',
    },
  });

  const onSubmit = async (values: CreateOwnerFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/owners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...values,
          propertyId: values.propertyId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create owner');
      }

      toast.success('Propriétaire créé avec succès');
      form.reset();
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du propriétaire');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau propriétaire</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau propriétaire à votre organisation
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Prénom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="+221 XX XXX XX XX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => {
                const selectedProperty = properties.find((p: any) => p.id === field.value);
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>Propriété</FormLabel>
                    <Popover open={propertyPopoverOpen} onOpenChange={setPropertyPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {selectedProperty ? selectedProperty.name : "Sélectionner une propriété (optionnel)"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-[var(--radix-popover-trigger-width)] p-0" 
                        align="start"
                        side="bottom"
                        sideOffset={4}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <Command shouldFilter={true} className="rounded-lg border-none shadow-none">
                          <CommandInput 
                            placeholder="Rechercher une propriété..." 
                            className="h-9"
                          />
                          <CommandList className="max-h-[300px] overflow-y-auto">
                            <CommandEmpty>
                              Aucune propriété trouvée.
                            </CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  field.onChange('');
                                  setPropertyPopoverOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                Aucune propriété
                              </CommandItem>
                              {properties.map((property: any) => (
                                <CommandItem
                                  key={property.id}
                                  value={`${property.name} ${property.address || ''}`}
                                  onSelect={() => {
                                    field.onChange(property.id);
                                    setPropertyPopoverOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === property.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="font-medium truncate">{property.name}</span>
                                    {property.address && (
                                      <span className="text-xs text-muted-foreground truncate">{property.address}</span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la banque</FormLabel>
                    <FormControl>
                      <Input placeholder="Banque" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bankAccount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de compte</FormLabel>
                    <FormControl>
                      <Input placeholder="Numéro de compte" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="commissionRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taux de commission (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      placeholder="20"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes supplémentaires..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer le propriétaire
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

