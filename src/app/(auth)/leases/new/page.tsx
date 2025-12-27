'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import {
  ChevronRight,
  ChevronLeft,
  Save,
  FileText,
  DollarSign,
  AlertTriangle,
  HelpCircle,
  Phone,
  Building2,
  Info,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Fetch units and tenants
async function getUnits() {
  const response = await fetch('/api/units');
  if (!response.ok) throw new Error('Failed to fetch units');
  return response.json();
}

async function getTenants() {
  const response = await fetch('/api/tenants');
  if (!response.ok) throw new Error('Failed to fetch tenants');
  return response.json();
}

// Form schema
const leaseFormSchema = z.object({
  // Step 1: Property & Tenant
  unitId: z.string().min(1, 'Le lot est requis'),
  tenantId: z.string().min(1, 'Le locataire est requis'),
  
  // Step 2: Financial conditions
  rentAmount: z.number().min(0, 'Le loyer doit être positif'),
  chargesAmount: z.number().min(0, 'Les charges doivent être positives'),
  chargesIncluded: z.boolean(),
  depositAmount: z.number().min(0, 'La caution doit être positive'),
  paymentDay: z.string().min(1, 'La date de paiement est requise'),
  paymentMethods: z.array(z.string()).min(1, 'Au moins un mode de paiement est requis'),
  gracePeriod: z.number().min(0),
  penaltyRate: z.number().min(0),
  indexationEnabled: z.boolean(),
  indexationRate: z.number().min(0),
  indexationDate: z.string(),
  
  // Step 3: Clauses & Options (to be added)
  // Step 4: Signature (to be added)
  
  // Dates
  startDate: z.string().min(1, 'La date de début est requise'),
  endDate: z.string().optional(),
});

type LeaseFormValues = z.infer<typeof leaseFormSchema>;

// Convert number to words in French (simplified version)
function numberToWords(num: number): string {
  const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  
  if (num === 0) return 'zéro';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    if (ten === 7) {
      return 'soixante-' + (one > 0 ? teens[one] : 'dix');
    }
    if (ten === 9) {
      return 'quatre-vingt-' + (one > 0 ? teens[one] : 'dix');
    }
    if (ten === 8 && one === 0) return 'quatre-vingts';
    return tens[ten] + (one > 0 ? '-' + ones[one] : '');
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    let result = hundred === 1 ? 'cent' : ones[hundred] + ' cent';
    if (hundred > 1 && remainder === 0) result += 's';
    if (remainder > 0) {
      result += ' ' + numberToWords(remainder);
    }
    return result;
  }
  if (num < 1000000) {
    const thousand = Math.floor(num / 1000);
    const remainder = num % 1000;
    let result = thousand === 1 ? 'mille' : numberToWords(thousand) + ' mille';
    if (remainder > 0) {
      result += ' ' + numberToWords(remainder);
    }
    return result;
  }
  return num.toString();
}

export default function NewLeasePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1); // Start at step 1
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const { canAccessFeature, canAccessObject } = useAccess();
  const { data: units, isLoading: unitsLoading } = useDataQuery(['units'], getUnits);
  const { data: tenants, isLoading: tenantsLoading } = useDataQuery(['tenants'], getTenants);

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canAccessFeature('leases_basic', 'canCreateLeases') && 
      !canAccessObject('Lease', 'create')) {
    return (
      <AccessDenied
        featureName="Création de baux"
        requiredPlan="premium"
        icon="lock"
      />
    );
  }

  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      unitId: '',
      tenantId: '',
      rentAmount: 350000,
      chargesAmount: 25000,
      chargesIncluded: true,
      depositAmount: 700000,
      paymentDay: '5',
      paymentMethods: ['wave', 'orange_money'],
      gracePeriod: 5,
      penaltyRate: 0.5,
      indexationEnabled: false,
      indexationRate: 3,
      indexationDate: '',
      startDate: '',
      endDate: '',
    },
  });

  const watchedValues = form.watch();
  const selectedUnit = units?.find((u: any) => u.id === watchedValues.unitId);
  const selectedTenant = tenants?.find((t: any) => t.id === watchedValues.tenantId);

  // Calculate financial summary
  const totalMonthlyRent = watchedValues.rentAmount + (watchedValues.chargesIncluded ? 0 : watchedValues.chargesAmount);
  const firstPayment = watchedValues.rentAmount + watchedValues.depositAmount;
  const annualRent = watchedValues.rentAmount * 12;
  const rentInWords = watchedValues.rentAmount > 0 
    ? numberToWords(Math.floor(watchedValues.rentAmount / 1000)) + ' mille'
    : 'zéro';
  const depositMonths = watchedValues.rentAmount > 0 
    ? watchedValues.depositAmount / watchedValues.rentAmount 
    : 0;

  const handleNext = () => {
    if (currentStep === 1) {
      form.trigger(['unitId', 'tenantId']).then((isValid) => {
        if (isValid) setCurrentStep(2);
      });
    } else if (currentStep === 2) {
      form.trigger(['rentAmount', 'chargesAmount', 'depositAmount', 'paymentDay', 'paymentMethods']).then((isValid) => {
        if (isValid) setCurrentStep(3);
      });
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSaveDraft = () => {
    // Save draft to localStorage
    const draft = form.getValues();
    localStorage.setItem('lease-draft', JSON.stringify(draft));
    setDraftSaved(true);
    toast.success('Brouillon sauvegardé');
    setTimeout(() => setDraftSaved(false), 3000);
  };

  const handleSubmit = async (data: LeaseFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: data.unitId,
          tenantId: data.tenantId,
          startDate: data.startDate,
          endDate: data.endDate || null,
          rentAmount: data.rentAmount,
          depositPaid: false,
          signed: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du bail');
      }

      toast.success('Bail créé avec succès!');
      router.push('/leases');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du bail');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('lease-draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        form.reset(parsed);
      } catch (e) {
        console.error('Error loading draft:', e);
      }
    }
  }, [form]);

  const steps = [
    { number: 1, label: 'Bien & Locataire', status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'active' : 'pending' },
    { number: 2, label: 'Conditions financières', status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : 'pending' },
    { number: 3, label: 'Clauses & Options', status: currentStep > 3 ? 'completed' : currentStep === 3 ? 'active' : 'pending' },
    { number: 4, label: 'Signature', status: currentStep === 4 ? 'active' : 'pending' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/leases" className="hover:text-blue-600">
              Baux
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span>Création de bail</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Créer un nouveau bail</h1>
          <p className="text-gray-600 mt-1">
            Complétez les informations étape par étape pour générer le contrat
          </p>
        </div>
        <Button variant="outline" onClick={handleSaveDraft}>
          <Save className="h-4 w-4 mr-2" />
          Sauvegarder brouillon
        </Button>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center font-semibold',
                        step.status === 'completed'
                          ? 'bg-blue-600 text-white'
                          : step.status === 'active'
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                          : 'bg-gray-200 text-gray-600'
                      )}
                    >
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        step.number
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          'flex-1 h-1 mx-2',
                          step.status === 'completed' ? 'bg-blue-600' : 'bg-gray-200'
                        )}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      step.status === 'active'
                        ? 'text-blue-600'
                        : step.status === 'completed'
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    )}
                  >
                    {step.status === 'completed' && 'Complété'}
                    {step.status === 'active' && 'En cours'}
                    {step.status === 'pending' && 'À venir'}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 mt-1">{step.label}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          {/* Step 1: Property & Tenant */}
          {currentStep === 1 && (
            <Card>
              <CardHeader className="bg-blue-50 border-b border-blue-100">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Building2 className="h-5 w-5" />
                  Bien & Locataire
                </CardTitle>
                <CardDescription>
                  Sélectionnez le bien et le locataire pour ce bail
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <FormField
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lot *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={unitsLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un lot" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {units?.map((unit: any) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.unitNumber} - {unit.propertyName}
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
                  name="tenantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Locataire *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={tenantsLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un locataire" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tenants?.map((tenant: any) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.firstName} {tenant.lastName}
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
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de début *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de fin</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Financial Conditions */}
          {currentStep === 2 && (
            <Card>
              <CardHeader className="bg-teal-50 border-b border-teal-100">
                <CardTitle className="flex items-center gap-2 text-teal-900">
                  <FileText className="h-5 w-5" />
                  Conditions financières
                </CardTitle>
                <CardDescription>
                  Définissez le loyer, les charges et les modalités de paiement
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Monthly Rent */}
                <FormField
                  control={form.control}
                  name="rentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant du loyer mensuel *</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="flex-1"
                          />
                        </FormControl>
                        <span className="text-gray-600 font-medium">FCFA</span>
                      </div>
                      <FormDescription>
                        Loyer en lettres: <strong>{rentInWords} francs CFA</strong>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Monthly Charges */}
                <FormField
                  control={form.control}
                  name="chargesAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Charges mensuelles *</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="flex-1"
                          />
                        </FormControl>
                        <span className="text-gray-600 font-medium">FCFA</span>
                      </div>
                      <FormField
                        control={form.control}
                        name="chargesIncluded"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Charges incluses dans le loyer</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Security Deposit */}
                <FormField
                  control={form.control}
                  name="depositAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dépôt de garantie *</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="flex-1"
                          />
                        </FormControl>
                        <span className="text-gray-600 font-medium">FCFA</span>
                      </div>
                      <FormDescription className="flex items-center gap-1">
                        <Info className="h-4 w-4 text-gray-400" />
                        Équivalent à {depositMonths.toFixed(1)} mois de loyer
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Date */}
                <FormField
                  control={form.control}
                  name="paymentDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de paiement mensuel *</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          {['1', '5', '10'].map((day) => (
                            <Button
                              key={day}
                              type="button"
                              variant={field.value === day ? 'default' : 'outline'}
                              onClick={() => field.onChange(day)}
                              className={field.value === day ? 'bg-blue-600 text-white' : ''}
                            >
                              {day === '1' ? '1er du mois' : `${day} du mois`}
                            </Button>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Methods */}
                <FormField
                  control={form.control}
                  name="paymentMethods"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modes de paiement acceptés *</FormLabel>
                      <FormControl>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { value: 'wave', label: 'Wave', icon: Phone },
                            { value: 'orange_money', label: 'Orange Money', icon: Phone },
                            { value: 'virement', label: 'Virement', icon: Building2 },
                          ].map((method) => {
                            const Icon = method.icon;
                            const currentMethods = field.value || [];
                            const isSelected = currentMethods.includes(method.value);
                            return (
                              <Button
                                key={method.value}
                                type="button"
                                variant={isSelected ? 'default' : 'outline'}
                                onClick={() => {
                                  if (isSelected) {
                                    field.onChange(currentMethods.filter((v: string) => v !== method.value));
                                  } else {
                                    field.onChange([...currentMethods, method.value]);
                                  }
                                }}
                                className={cn(
                                  'flex items-center gap-2',
                                  isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                {method.label}
                                {isSelected && <CheckCircle2 className="h-4 w-4" />}
                              </Button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Sélectionnez au moins un mode de paiement accepté
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Late Penalties */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="h-5 w-5" />
                    <h3 className="font-semibold">Pénalités de retard</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gracePeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Délai de grâce (jours)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="penaltyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pénalité par jour (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Indexation Clause */}
                <div className="space-y-4 pt-4 border-t">
                  <FormField
                    control={form.control}
                    name="indexationEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none flex-1">
                          <FormLabel>Clause d'indexation annuelle</FormLabel>
                          <FormDescription>
                            Le loyer sera réévalué chaque année selon l'indice des prix à la consommation
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  {watchedValues.indexationEnabled && (
                    <div className="grid grid-cols-2 gap-4 ml-7">
                      <FormField
                        control={form.control}
                        name="indexationRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Taux d'indexation (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
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
                        name="indexationDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date d'application</FormLabel>
                            <FormControl>
                              <Input type="date" placeholder="jj/mm/aaaa" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <DollarSign className="h-5 w-5" />
                      Récapitulatif financier
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Loyer mensuel total</span>
                      <span className="font-bold text-gray-900">
                        {totalMonthlyRent.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">(Loyer + charges)</p>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-700">Premier versement</span>
                      <span className="font-bold text-gray-900">
                        {firstPayment.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">(1er loyer + dépôt)</p>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-700">Loyer annuel</span>
                      <span className="font-bold text-gray-900">
                        {annualRent.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">(12 mois)</p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Clauses & Options */}
          {currentStep === 3 && (
            <Card>
              <CardHeader className="bg-purple-50 border-b border-purple-100">
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <FileText className="h-5 w-5" />
                  Clauses & Options
                </CardTitle>
                <CardDescription>
                  Configurez les clauses spécifiques et les options du bail
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-gray-600">Cette section sera implémentée prochainement.</p>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Signature */}
          {currentStep === 4 && (
            <Card>
              <CardHeader className="bg-green-50 border-b border-green-100">
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <FileText className="h-5 w-5" />
                  Signature
                </CardTitle>
                <CardDescription>
                  Finalisez et signez le contrat de bail
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-gray-600">Cette section sera implémentée prochainement.</p>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={handleSaveDraft}>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder
              </Button>
              {currentStep < 4 ? (
                <Button type="button" onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Continuer
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      Créer le bail
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>

      {/* Help Section */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <HelpCircle className="h-6 w-6 text-yellow-600 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Besoin d'aide?</h3>
              <p className="text-sm text-gray-700 mb-4">
                Notre équipe est disponible pour vous accompagner dans la création de votre bail
              </p>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">
                  <Phone className="h-4 w-4 mr-2" />
                  Contacter le support
                </Button>
                <Link href="#" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Guide de création
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

