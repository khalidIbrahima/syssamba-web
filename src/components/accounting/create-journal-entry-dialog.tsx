'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, Trash2, AlertCircle, Search, Filter, X, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useDataQuery } from '@/hooks/use-query';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const journalEntryFormSchema = z.object({
  entryDate: z.string().min(1, 'La date est requise'),
  reference: z.string().min(1, 'La référence est requise'),
  description: z.string().optional(),
  lines: z.array(z.object({
    accountId: z.string().min(1, 'Le compte est requis'),
    debit: z.number().min(0, 'Le débit doit être positif'),
    credit: z.number().min(0, 'Le crédit doit être positif'),
    description: z.string().optional(),
  })).min(2, 'Au moins 2 lignes sont requises'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  {
    message: 'Le total débit doit être égal au total crédit',
    path: ['lines'],
  }
);

type JournalEntryFormValues = z.infer<typeof journalEntryFormSchema>;

// Fetch accounts
async function getAccounts() {
  const response = await fetch('/api/accounting/accounts', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch accounts');
  }
  return response.json();
}

interface CreateJournalEntryDialogProps {
  children?: React.ReactNode;
}

export function CreateJournalEntryDialog({ children }: CreateJournalEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [accountPopoverOpen, setAccountPopoverOpen] = useState<Record<number, boolean>>({});
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ accountNumber: '', label: '', category: '1' });
  const queryClient = useQueryClient();

  const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useDataQuery(
    ['accounts'],
    getAccounts
  );

  const form = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntryFormSchema),
    defaultValues: {
      entryDate: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
      lines: [
        { accountId: '', debit: 0, credit: 0, description: '' },
        { accountId: '', debit: 0, credit: 0, description: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const watchedLines = form.watch('lines');
  const totalDebit = watchedLines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = watchedLines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const onSubmit = async (data: JournalEntryFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/accounting/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création de l\'écriture');
      }

      const entry = await response.json();
      toast.success('Écriture comptable créée avec succès!');
      
      // Invalidate and refetch journal entries
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      
      form.reset({
        entryDate: new Date().toISOString().split('T')[0],
        reference: '',
        description: '',
        lines: [
          { accountId: '', debit: 0, credit: 0, description: '' },
          { accountId: '', debit: 0, credit: 0, description: '' },
        ],
      });
      setOpen(false);
    } catch (error: any) {
      console.error('Error creating journal entry:', error);
      toast.error(error.message || 'Erreur lors de la création de l\'écriture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR');
  };

  // Filter accounts by category (global filter)
  const categoryFilteredAccounts = accounts?.filter((account: any) => {
    const matchesCategory = selectedCategories.length === 0 || 
      selectedCategories.includes(account.category);
    return matchesCategory;
  }) || [];

  // Get unique categories
  const categories = Array.from(new Set(accounts?.map((a: any) => String(a.category)) || [])).sort() as string[];

  // Handle create account
  const handleCreateAccount = async () => {
    if (!newAccount.accountNumber || !newAccount.label || !newAccount.category) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsCreatingAccount(true);
    try {
      const response = await fetch('/api/accounting/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAccount),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du compte');
      }

      const createdAccount = await response.json();
      toast.success('Compte créé avec succès!');
      
      // Refresh accounts list
      await refetchAccounts();
      
      // Reset form
      setNewAccount({ accountNumber: '', label: '', category: '1' });
      setCreateAccountOpen(false);
      
      // Set the newly created account in the current field
      // This will be handled by the parent component
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast.error(error.message || 'Erreur lors de la création du compte');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children || (
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Écriture
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto z-50" onInteractOutside={(e) => {
          // Allow interactions with PopoverContent
          const target = e.target as HTMLElement;
          if (target.closest('[data-radix-popover-content]')) {
            e.preventDefault();
          }
        }}>
        <DialogHeader>
          <DialogTitle>Créer une nouvelle écriture comptable</DialogTitle>
          <DialogDescription>
            Remplissez les informations pour créer une nouvelle écriture. Le total débit doit être égal au total crédit.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="entryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date d'écriture *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence (Nº Pièce) *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: LOY-2024-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description de l'écriture..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Journal Lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>Lignes comptables *</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ accountId: '', debit: 0, credit: 0, description: '' })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une ligne
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Ligne {index + 1}</span>
                      {fields.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.accountId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Compte *</FormLabel>
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Popover 
                                  open={accountPopoverOpen[index] || false} 
                                  onOpenChange={(open) => {
                                    setAccountPopoverOpen((prev) => ({ ...prev, [index]: open }));
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          "w-full justify-between",
                                          !field.value && "text-muted-foreground"
                                        )}
                                        disabled={accountsLoading}
                                      >
                                        {field.value
                                          ? (() => {
                                              const selectedAccount = accounts?.find((acc: any) => acc.id === field.value);
                                              return selectedAccount 
                                                ? `${selectedAccount.accountNumber} - ${selectedAccount.label}`
                                                : "Sélectionner un compte";
                                            })()
                                          : "Sélectionner un compte"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent 
                                    className="w-[var(--radix-popover-trigger-width)] max-w-[400px] min-w-[300px] p-0 z-[9999]" 
                                    align="start"
                                    side="bottom"
                                    sideOffset={4}
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                    style={{ pointerEvents: 'auto' }}
                                  >
                                    <Command shouldFilter={true} className="rounded-lg border-none shadow-none">
                                      <CommandInput 
                                        placeholder="Rechercher un compte (numéro ou libellé)..." 
                                        className="h-9"
                                      />
                                      <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
                                        <CommandEmpty>
                                          {accountsLoading ? "Chargement..." : "Aucun compte trouvé."}
                                        </CommandEmpty>
                                        <CommandGroup>
                                          {categoryFilteredAccounts.length > 0 ? (
                                            categoryFilteredAccounts.map((account: any) => {
                                              const accountValue = `${account.accountNumber} ${account.label} ${account.category}`;
                                              return (
                                              <CommandItem
                                                key={account.id}
                                                value={accountValue}
                                                onSelect={(value) => {
                                                  console.log('Selecting account:', account.id, value);
                                                  // Update the form field using both methods for reliability
                                                  form.setValue(`lines.${index}.accountId`, account.id, { shouldValidate: true });
                                                  field.onChange(account.id);
                                                  // Close the popover after a small delay to ensure state is updated
                                                  setTimeout(() => {
                                                    setAccountPopoverOpen((prev) => ({ ...prev, [index]: false }));
                                                  }, 150);
                                                }}
                                                className="cursor-pointer hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    field.value === account.id ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                <div className="flex flex-col flex-1 min-w-0">
                                                  <span className="font-medium truncate">{account.accountNumber} - {account.label}</span>
                                                  <span className="text-xs text-muted-foreground">Classe {account.category}</span>
                                                </div>
                                              </CommandItem>
                                              );
                                            })
                                          ) : (
                                            <div className="py-6 text-center text-sm text-muted-foreground">
                                              Aucun compte disponible
                                            </div>
                                          )}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button type="button" variant="outline" size="icon">
                                      <Filter className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-56">
                                    <div className="space-y-2">
                                      <div className="font-medium text-sm">Filtrer par classe</div>
                                      <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {categories.map((cat: string) => (
                                          <div key={cat} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`category-${cat}`}
                                              checked={selectedCategories.includes(cat)}
                                              onCheckedChange={(checked) => {
                                                if (checked) {
                                                  setSelectedCategories([...selectedCategories, cat]);
                                                } else {
                                                  setSelectedCategories(selectedCategories.filter((c: string) => c !== cat));
                                                }
                                              }}
                                            />
                                            <label
                                              htmlFor={`category-${cat}`}
                                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                              Classe {cat}
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                      {selectedCategories.length > 0 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="w-full"
                                          onClick={() => setSelectedCategories([])}
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Réinitialiser
                                        </Button>
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setCreateAccountOpen(true)}
                                  title="Créer un nouveau compte"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input placeholder="Description de la ligne" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.debit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Débit</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  field.onChange(value);
                                  // Auto-clear credit when debit is entered
                                  if (value > 0) {
                                    form.setValue(`lines.${index}.credit`, 0);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`lines.${index}.credit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Crédit</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  field.onChange(value);
                                  // Auto-clear debit when credit is entered
                                  if (value > 0) {
                                    form.setValue(`lines.${index}.debit`, 0);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Balance Summary */}
            <div className={cn(
              "p-4 rounded-lg border-2",
              isBalanced ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isBalanced ? (
                    <AlertCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={cn(
                    "font-semibold",
                    isBalanced ? "text-green-800" : "text-red-800"
                  )}>
                    {isBalanced ? 'Écriture équilibrée' : 'Écriture déséquilibrée'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Débit:</span>
                  <span className="ml-2 font-semibold">{formatCurrency(totalDebit)} FCFA</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Crédit:</span>
                  <span className="ml-2 font-semibold">{formatCurrency(totalCredit)} FCFA</span>
                </div>
                <div className="col-span-2 pt-2 border-t">
                  <span className="text-muted-foreground">Différence:</span>
                  <span className={cn(
                    "ml-2 font-semibold",
                    isBalanced ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(Math.abs(totalDebit - totalCredit))} FCFA
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !isBalanced}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer l'écriture
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau compte</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau compte au plan comptable SYSCOHADA
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Numéro de compte *</label>
              <Input
                placeholder="Ex: 7012"
                value={newAccount.accountNumber}
                onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Libellé *</label>
              <Input
                placeholder="Ex: Loyers perçus"
                value={newAccount.label}
                onChange={(e) => setNewAccount({ ...newAccount, label: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Classe *</label>
              <Select
                value={newAccount.category}
                onValueChange={(value) => setNewAccount({ ...newAccount, category: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      Classe {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateAccountOpen(false);
                  setNewAccount({ accountNumber: '', label: '', category: '1' });
                }}
                disabled={isCreatingAccount}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleCreateAccount}
                disabled={isCreatingAccount || !newAccount.accountNumber || !newAccount.label}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isCreatingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

