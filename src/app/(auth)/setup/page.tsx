'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Building2,
  Loader2,
  Globe,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Handshake,
  Users,
  Home,
  Sparkles,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';
import { getDefaultCountry } from '@/lib/countries';
import { cn } from '@/lib/utils';

// Fetch available plans
async function getPlans() {
  const response = await fetch('/api/plans');
  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }
  const data = await response.json();
  return data.plans || [];
}

// Fetch available countries
async function getCountries() {
  const response = await fetch('/api/countries');
  if (!response.ok) {
    throw new Error('Failed to fetch countries');
  }
  const data = await response.json();
  return data.countries || [];
}

// Fetch current user data
async function getCurrentUser() {
  const response = await fetch('/api/user/profile');
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.user || null;
}

// Organization types with plan recommendations
const organizationTypes = [
  {
    id: 'individual',
    name: 'Particulier',
    description: 'Gestion de votre patrimoine immobilier personnel',
    icon: Home,
    iconColor: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    recommendedPlan: 'freemium',
    features: [
      'Gestion simple',
      'Suivi des revenus',
      'Rapports de base',
    ],
  },
  {
    id: 'agency',
    name: 'Agence',
    description: 'Agence immobilière gérant plusieurs biens pour différents propriétaires',
    icon: Building2,
    iconColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    recommendedPlan: 'starter',
    features: [
      'Multi-propriétaires',
      'Gestion locative complète',
      'Extranet personnalisé',
      'Équipe & collaborateurs',
    ],
    recommended: true,
  },
  {
    id: 'sci',
    name: 'SCI',
    description: 'Société Civile Immobilière gérant son patrimoine en copropriété',
    icon: Handshake,
    iconColor: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    recommendedPlan: 'pro',
    features: [
      'Gestion de patrimoine',
      'Comptabilité SYSCOHADA',
      'Suivi associés',
      'Rapports financiers',
    ],
  },
  {
    id: 'syndic',
    name: 'Syndic',
    description: 'Syndic de copropriété gérant des immeubles et résidences',
    icon: Users,
    iconColor: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    recommendedPlan: 'agency',
    features: [
      'Gestion multi-résidences',
      'Charges de copropriété',
      'Assemblées générales',
      'Rapports réglementaires',
    ],
  },
];

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState<{ firstName?: string; lastName?: string } | null>(null);
  const [formData, setFormData] = useState({
    organizationName: '',
    organizationType: 'individual',
    country: getDefaultCountry().code,
    planName: 'freemium',
    billingPeriod: 'monthly',
  });
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | 'wave' | 'orange_money' | ''>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const { data: plans, isLoading: plansLoading } = useDataQuery(['plans'], getPlans);
  const { data: countriesData, isLoading: countriesLoading } = useDataQuery(['countries'], getCountries);
  const { data: currentUser } = useDataQuery(['currentUser'], getCurrentUser);
  const countries = countriesData?.countries || [];

  // Pre-fill organization name from user data
  useEffect(() => {
    if (currentUser && !formData.organizationName) {
      const fullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
      if (fullName) {
        setFormData(prev => ({ ...prev, organizationName: fullName }));
      }
    }
  }, [currentUser, formData.organizationName]);

  // Update recommended plan when organization type changes
  useEffect(() => {
    const orgType = organizationTypes.find(t => t.id === formData.organizationType);
    if (orgType) {
      setFormData(prev => ({ ...prev, planName: orgType.recommendedPlan }));
    }
  }, [formData.organizationType]);

  // Check if payment is required
  const isPaymentRequired = () => {
    if (formData.planName === 'freemium') return false;
    const plan = plans?.find((p: any) => p.name === formData.planName);
    if (!plan) return false;
    const price = plan.price;
    return price !== 'custom' && price !== null && price !== undefined && typeof price === 'number' && price > 0;
  };

  // Calculate total steps
  const totalSteps = isPaymentRequired() ? 3 : 2;

  // Handle step navigation
  const handleNext = () => {
    if (currentStep === 1) {
      // Validate step 1
      if (!formData.organizationName.trim()) {
        toast.error('Veuillez saisir le nom de l\'organisation');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // If payment is required, go to payment step
      if (isPaymentRequired()) {
        setCurrentStep(3);
      } else {
        // Otherwise, submit directly
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartFree = async () => {
    // Set to freemium and submit
    setFormData(prev => ({ ...prev, planName: 'freemium', billingPeriod: 'monthly' }));
    await handleSubmit();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setIsSubmitting(true);

    try {
      // First, setup the organization
      const setupResponse = await fetch('/api/organization/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!setupResponse.ok) {
        const error = await setupResponse.json();
        throw new Error(error.error || 'Failed to setup organization');
      }

      const setupData = await setupResponse.json();
      
      // If payment is required and we're on payment step, process payment
      if (isPaymentRequired() && currentStep === 3 && paymentMethod) {
        setIsProcessingPayment(true);
        
        const paymentResponse = await fetch('/api/organization/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planName: formData.planName,
            billingPeriod: formData.billingPeriod,
            paymentMethod: paymentMethod,
          }),
        });

        if (!paymentResponse.ok) {
          const error = await paymentResponse.json();
          throw new Error(error.error || 'Payment failed');
        }

        const paymentData = await paymentResponse.json();
        toast.success('Paiement traité avec succès!');
      }

      toast.success('Organisation configurée avec succès!');
      
      // Redirect to dashboard
      window.location.href = setupData.redirectTo || '/dashboard';
    } catch (error: any) {
      console.error('Setup error:', error);
      toast.error(error.message || 'Erreur lors de la configuration');
    } finally {
      setIsSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  const selectedPlan = plans?.find((p: any) => p.name === formData.planName);
  const recommendedPlan = organizationTypes.find(t => t.id === formData.organizationType)?.recommendedPlan || 'freemium';
  const price = selectedPlan?.price;
  const displayPrice =
    price === 'custom' || price === null || price === undefined
      ? 'Sur devis'
      : formData.billingPeriod === 'yearly' && typeof price === 'number'
      ? `${Math.round(price * 12 * 0.8).toLocaleString('fr-FR')} FCFA/an`
      : typeof price === 'number'
      ? `${price.toLocaleString('fr-FR')} FCFA/mois`
      : 'Sur devis';

  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Configurons votre espace de travail
          </h1>
          <p className="text-muted-foreground mb-6">
            Quelques questions rapides pour personnaliser votre expérience Sys Samba
          </p>
          <div className="flex items-center justify-between mb-2">
            <div className="text-left">
              <p className="text-sm font-medium text-muted-foreground">Étape {currentStep} sur {totalSteps}</p>
              <Progress value={progress} className="h-2 w-48 mt-2" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">
                {currentStep === 1 && 'Informations organisation'}
                {currentStep === 2 && 'Choix du plan'}
                {currentStep === 3 && 'Paiement'}
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Essential Info */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Informations de votre organisation</CardTitle>
              <CardDescription>
                Commençons par les informations essentielles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Organization Name */}
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Nom de l'organisation *</Label>
                  <Input
                    id="organizationName"
                    placeholder="Ex: Mon Agence Immobilière"
                    value={formData.organizationName}
                    onChange={(e) =>
                      setFormData({ ...formData, organizationName: e.target.value })
                    }
                    required
                  />
                <p className="text-xs text-muted-foreground">
                  Ce nom sera utilisé pour identifier votre organisation
                </p>
                </div>

                {/* Organization Type */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Type d'organisation *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {organizationTypes.map((type) => {
                      const Icon = type.icon;
                      const isSelected = formData.organizationType === type.id;
                      return (
                        <Card
                          key={type.id}
                          className={cn(
                            'cursor-pointer transition-all relative',
                            isSelected
                              ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 shadow-lg'
                              : 'hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md',
                            type.bgColor
                          )}
                          onClick={() =>
                            setFormData({ ...formData, organizationType: type.id })
                          }
                        >
                          {type.recommended && (
                            <div className="absolute -top-3 right-4">
                              <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                                Recommandé
                              </span>
                            </div>
                          )}
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4 mb-4">
                              <div className={cn('p-3 rounded-lg', type.bgColor)}>
                                <Icon className={cn('h-6 w-6', type.iconColor)} />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-foreground mb-1">
                                  {type.name}
                                </h3>
                                <p className="text-sm text-muted-foreground">{type.description}</p>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                              )}
                            </div>
                            <ul className="space-y-2 mt-4">
                              {type.features.map((feature, idx) => (
                                <li key={idx} className="flex items-center text-sm text-muted-foreground">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label htmlFor="country" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Pays * (OHADA)
                  </Label>
                  <Select
                    value={formData.country}
                    onValueChange={(value) => setFormData({ ...formData, country: value })}
                    required
                  >
                    <SelectTrigger id="country">
                      <SelectValue placeholder="Sélectionner un pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {countriesLoading ? (
                        <SelectItem value="" disabled>Chargement...</SelectItem>
                      ) : countries.length > 0 ? (
                        countries.map((country: any) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name} ({country.code}) - {country.currencySymbol}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>Aucun pays disponible</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Espace OHADA - Organisation pour l'Harmonisation en Afrique du Droit des
                    Affaires
                  </p>
                </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!formData.organizationName.trim()}
                >
                  Continuer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Plan Selection */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Choisissez votre plan</CardTitle>
              <CardDescription>
                Sélectionnez le plan adapté à vos besoins
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Recommended Plan Banner */}
              {recommendedPlan && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-900 dark:text-blue-300">
                    <strong>Recommandation :</strong> Pour une organisation de type{' '}
                    <strong>{organizationTypes.find(t => t.id === formData.organizationType)?.name}</strong>,
                    nous vous recommandons le plan{' '}
                    <strong>
                      {plans?.find((p: any) => p.name === recommendedPlan)?.displayName ||
                        recommendedPlan}
                    </strong>
                    . Ce plan est parfaitement adapté à vos besoins !
                  </p>
                </div>
              )}

              {/* Start Free Option */}
              <div className="mb-6">
                <Card className="border-2 border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-green-600 rounded-lg p-3">
                          <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground mb-1">
                            Commencer gratuitement
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Testez Sys Samba avec le plan Freemium. Vous pourrez toujours mettre à niveau plus tard.
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleStartFree}
                        disabled={isSubmitting}
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Configuration...
                          </>
                        ) : (
                          'Commencer gratuitement'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Plans Grid */}
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {plans?.map((plan: any) => {
                    const isRecommended = plan.name === recommendedPlan;
                    const isSelected = formData.planName === plan.name;
                    const planPrice = plan.price === 'custom' || plan.price === null || plan.price === undefined
                      ? 'Sur devis'
                      : typeof plan.price === 'number'
                      ? `${plan.price.toLocaleString('fr-FR')} FCFA/mois`
                      : 'Sur devis';
                    
                    // Get key features from plan.features
                    const features = plan.features || {};
                    const keyFeatures = [
                      features.properties_management && 'Gestion des biens',
                      features.units_management && 'Gestion des lots',
                      features.tenants_full && 'Gestion complète locataires',
                      features.payments_all_methods && 'Paiements (Wave/Orange)',
                      features.accounting_sycoda_full && 'Comptabilité SYSCOHADA',
                    ].filter(Boolean);

                    return (
                      <Card
                        key={plan.name}
                        className={cn(
                          'cursor-pointer transition-all relative',
                          isSelected
                            ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 shadow-lg'
                            : 'hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md',
                          isRecommended && !isSelected && 'border-blue-300 dark:border-blue-700'
                        )}
                        onClick={() => setFormData({ ...formData, planName: plan.name })}
                      >
                        {isRecommended && (
                          <div className="absolute -top-3 right-4">
                            <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                              Recommandé
                            </span>
                          </div>
                        )}
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-foreground mb-1">
                                {plan.displayName || plan.name}
                              </h3>
                              {plan.description && (
                                <p className="text-sm text-muted-foreground">{plan.description}</p>
                              )}
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            )}
                          </div>

                          {/* Price */}
                          <div className="mb-4">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                              {planPrice}
                            </p>
                            {plan.price !== 'custom' && plan.price !== null && typeof plan.price === 'number' && (
                              <p className="text-xs text-muted-foreground">
                                Facturation mensuelle
                              </p>
                            )}
                          </div>

                          {/* Limits */}
                          <div className="space-y-2 mb-4 pb-4 border-b">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Lots</span>
                              <span className="font-semibold text-foreground">
                                {plan.lots_limit === null || plan.lots_limit === undefined ? 'Illimités' : plan.lots_limit}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Utilisateurs</span>
                              <span className="font-semibold text-foreground">
                                {plan.users_limit === null || plan.users_limit === undefined ? 'Illimités' : plan.users_limit}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Locataires extranet</span>
                              <span className="font-semibold text-foreground">
                                {plan.extranet_tenants_limit === null || plan.extranet_tenants_limit === undefined ? 'Illimités' : plan.extranet_tenants_limit}
                              </span>
                            </div>
                          </div>

                          {/* Key Features */}
                          {keyFeatures.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">Fonctionnalités</p>
                              <ul className="space-y-1">
                                {keyFeatures.slice(0, 5).map((feature, idx) => (
                                  <li key={idx} className="flex items-center text-xs text-muted-foreground">
                                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                                    <span>{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Billing Period */}
              {selectedPlan &&
                selectedPlan.price !== 'custom' &&
                selectedPlan.price !== null &&
                selectedPlan.price !== undefined &&
                typeof selectedPlan.price === 'number' &&
                selectedPlan.price > 0 && (
                  <div className="space-y-3 mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                    <Label className="text-base font-semibold">Période de facturation</Label>
                    <RadioGroup
                      value={formData.billingPeriod}
                      onValueChange={(value) =>
                        setFormData({ ...formData, billingPeriod: value })
                      }
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="monthly" id="monthly" />
                        <Label htmlFor="monthly" className="cursor-pointer">
                          Mensuel
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yearly" id="yearly" />
                        <Label htmlFor="yearly" className="cursor-pointer">
                          Annuel <span className="text-green-600 dark:text-green-400 font-semibold">(-20%)</span>
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-sm text-muted-foreground">
                      Prix final: <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{displayPrice}</span>
                    </p>
                  </div>
                )}

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Configuration...
                    </>
                  ) : (
                    <>
                      {isPaymentRequired() ? 'Continuer vers le paiement' : 'Finaliser la configuration'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
