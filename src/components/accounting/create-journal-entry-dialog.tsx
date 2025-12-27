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
import { Plus, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useDataQuery } from '@/hooks/use-query';
import { cn } from '@/lib/utils';

const journalEntryFormSchema = z.object({
  entryDate: z.string().min(1, 'La date est requise'),
  reference: z.string().min(1, 'La référence est requise'),
  description: z.string().optional(),
  lines: z.array(z.object({
    accountId: z.string().uuid('Le compte est requis'),
    debit: z.number().min(0, 'Le débit doit être positif').default(0),
    credit: z.number().min(0, 'Le crédit doit être positif').default(0),
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
  const queryClient = useQueryClient();

  const { data: accounts, isLoading: accountsLoading } = useDataQuery(
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Écriture
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
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
                      <span className="text-sm font-medium text-gray-700">Ligne {index + 1}</span>
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
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={accountsLoading}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner un compte" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {accounts?.map((account: any) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.accountNumber} - {account.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                  <span className="text-gray-600">Total Débit:</span>
                  <span className="ml-2 font-semibold">{formatCurrency(totalDebit)} FCFA</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Crédit:</span>
                  <span className="ml-2 font-semibold">{formatCurrency(totalCredit)} FCFA</span>
                </div>
                <div className="col-span-2 pt-2 border-t">
                  <span className="text-gray-600">Différence:</span>
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
  );
}

