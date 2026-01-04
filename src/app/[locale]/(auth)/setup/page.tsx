'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Home,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Handshake,
  Users,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';
import { OHADA_COUNTRIES, getDefaultCountry } from '@/lib/countries';
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

// Lots range options with recommended plans
const lotsRanges = [
  {
    id: 'none',
    label: 'Pas encore de lots',
    description: 'Je démarre dans l\'immobilier',
    icon: Sparkles,
    iconColor: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    recommendedPlan: 'freemium',
    recommendationText: 'Plan Freemium recommandé',
  },
  {
    id: '1-10',
    label: '1 à 10 lots',
    description: 'Particulier / Petit investisseur',
    icon: Home,
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    recommendedPlan: 'starter',
    recommendationText: 'Plan Starter recommandé',
  },
  {
    id: '11-50',
    label: '11 à 50 lots',
    description: 'Agence / SCI moyenne',
    icon: Building2,
    iconColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    recommendedPlan: 'pro',
    recommendationText: 'Plan Pro recommandé',
  },
  {
    id: '51-200',
    label: '51 à 200 lots',
    description: 'Grande agence',
    icon: Building2,
    iconColor: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    recommendedPlan: 'agency',
    recommendationText: 'Plan Business recommandé',
  },
  {
    id: '201-500',
    label: '201 à 500 lots',
    description: 'Syndic / Groupe',
    icon: Building2,
    iconColor: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    recommendedPlan: 'agency',
    recommendationText: 'Plan Enterprise recommandé',
  },
  {
    id: '500+',
    label: 'Plus de 500 lots',
    description: 'Enterprise / Institutionnel',
    icon: TrendingUp,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    recommendedPlan: 'enterprise',
    recommendationText: 'Solution sur mesure',
  },
];

// Organization types with details
const organizationTypes = [
  {
    id: 'agency',
    name: 'Agence',
    description: 'Agence immobilière gérant plusieurs biens pour différents propriétaires',
    icon: Building2,
    iconColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
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
    features: [
      'Gestion de patrimoine',
      'Comptabilité SYSCOHADA',
      'Suivi associés',
      'Rapports financiers',
    ],
    recommended: false,
  },
  {
    id: 'syndic',
    name: 'Syndic',
    description: 'Syndic de copropriété gérant des immeubles et résidences',
    icon: Users,
    iconColor: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    features: [
      'Multi-copropriétés',
      'Assemblées générales',
      'Charges communes',
      'Extranet copropriétaires',
    ],
    recommended: false,
  },
  {
    id: 'individual',
    name: 'Particulier',
    description: 'Propriétaire individuel gérant ses propres biens locatifs',
    icon: Home,
    iconColor: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    features: [
      'Gestion simplifiée',
      'Suivi loyers & charges',
      'Quittances automatiques',
      'Déclarations fiscales',
    ],
    recommended: false,
  },
];

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLotsRange, setSelectedLotsRange] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    organizationName: '',
    organizationType: 'individual',
    country: getDefaultCountry().code,
    planName: 'starter', // Default to starter if skipped
    billingPeriod: 'monthly',
  });

  const { data: plans, isLoading: plansLoading } = useDataQuery(['plans'], getPlans);

  // Get recommended plan based on lots range
  const recommendedPlan = selectedLotsRange
    ? lotsRanges.find((r) => r.id === selectedLotsRange)?.recommendedPlan || 'starter'
    : 'starter';

  // Update formData when recommended plan changes
  const handleLotsRangeSelect = (rangeId: string) => {
    setSelectedLotsRange(rangeId);
    const range = lotsRanges.find((r) => r.id === rangeId);
    if (range) {
      setFormData({ ...formData, planName: range.recommendedPlan });
    }
  };

  // Handle step navigation
  const handleNext = () => {
    if (currentStep === 1) {
      // If no selection, default to starter
      if (!selectedLotsRange) {
        setFormData({ ...formData, planName: 'starter' });
      } else {
        // Ensure recommended plan is selected
        const range = lotsRanges.find((r) => r.id === selectedLotsRange);
        if (range) {
          setFormData({ ...formData, planName: range.recommendedPlan });
        }
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  // Ensure recommended plan is selected when entering step 2
  useEffect(() => {
    if (currentStep === 2 && selectedLotsRange) {
      const range = lotsRanges.find((r) => r.id === selectedLotsRange);
      if (range && formData.planName !== range.recommendedPlan) {
        setFormData((prev) => ({ ...prev, planName: range.recommendedPlan }));
      }
    }
  }, [currentStep, selectedLotsRange, formData.planName]);

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/organization/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to setup organization');
      }

      const data = await response.json();
      toast.success('Organisation configurée avec succès!');
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Setup error:', error);
      toast.error(error.message || 'Erreur lors de la configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPlan = plans?.find((p: any) => p.name === formData.planName);
  const price = selectedPlan?.price;
  const displayPrice =
    price === 'custom' || price === null || price === undefined
      ? 'Sur devis'
      : formData.billingPeriod === 'yearly' && typeof price === 'number'
      ? `${Math.round(price * 12 * 0.8).toLocaleString('fr-FR')} FCFA/an`
      : typeof price === 'number'
      ? `${price.toLocaleString('fr-FR')} FCFA/mois`
      : 'Sur devis';

  const progress = (currentStep / 3) * 100;

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
              <p className="text-sm font-medium text-muted-foreground">Étape {currentStep} sur 3</p>
              <Progress value={progress} className="h-2 w-48 mt-2" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">
                {currentStep === 1 && 'Configuration initiale'}
                {currentStep === 2 && 'Choix du plan'}
                {currentStep === 3 && 'Informations organisation'}
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Lots Range Selection */}
        {currentStep === 1 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="bg-blue-600 rounded-lg p-3 inline-block mb-4">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Combien de lots gérez-vous actuellement ?
                </h2>
                <p className="text-muted-foreground">
                  Cette information nous aide à recommander le plan le plus adapté
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lotsRanges.map((range) => {
                  const Icon = range.icon;
                  const isSelected = selectedLotsRange === range.id;
                  return (
                    <Card
                      key={range.id}
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-lg',
                        isSelected
                          ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400'
                          : 'hover:border-blue-300 dark:hover:border-blue-700',
                        range.bgColor
                      )}
                      onClick={() => handleLotsRangeSelect(range.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className={cn('p-2 rounded-lg', range.bgColor)}>
                            <Icon className={cn('h-6 w-6', range.iconColor)} />
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <h3 className="font-semibold text-foreground mb-1">{range.label}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{range.description}</p>
                        <p
                          className={cn(
                            'text-xs font-medium',
                            range.recommendedPlan === 'enterprise'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-green-600 dark:text-green-400'
                          )}
                        >
                          {range.recommendationText}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
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
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Choisissez votre plan
                </h2>
                {selectedLotsRange && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 inline-block">
                    <p className="text-sm text-blue-900 dark:text-blue-300">
                      <strong>Recommandation :</strong> Basé sur votre sélection (
                      {lotsRanges.find((r) => r.id === selectedLotsRange)?.label}), nous vous
                      recommandons le plan{' '}
                      <strong>
                        {plans?.find((p: any) => p.name === recommendedPlan)?.displayName ||
                          recommendedPlan}
                      </strong>
                      . Ce plan est parfaitement adapté à vos besoins !
                    </p>
                  </div>
                )}
              </div>

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
                    
                    // Get key features from plan.features (from Supabase)
                    const features = plan.features || {};
                    const keyFeatures = [
                      features.properties_management && 'Gestion des biens',
                      features.units_management && 'Gestion des lots',
                      features.tenants_full && 'Gestion complète locataires',
                      features.leases_full && 'Gestion des baux',
                      features.payments_all_methods && 'Paiements (Wave/Orange)',
                      features.electronic_signature && 'Signature électronique',
                      features.accounting_sycoda_full && 'Comptabilité SYSCOHADA',
                      features.dsf_export && 'Export DSF',
                      features.bank_sync && 'Synchronisation bancaire',
                      features.custom_extranet_domain && 'Domaine extranet personnalisé',
                      features.full_white_label && 'Marque blanche complète',
                    ].filter(Boolean);

                    return (
                      <Card
                        key={plan.name}
                        className={cn(
                          'cursor-pointer transition-all relative',
                          isSelected
                            ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 shadow-lg'
                            : 'hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md',
                          isRecommended && !isSelected && 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                        )}
                        onClick={() => setFormData({ ...formData, planName: plan.name })}
                      >
                        {isRecommended && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                              Recommandé
                            </span>
                          </div>
                        )}
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-foreground">
                                {plan.displayName || plan.name}
                              </h3>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Fonctionnalités principales
                            </p>
                            <ul className="space-y-1.5">
                              {keyFeatures.slice(0, 5).map((feature, idx) => (
                                <li key={idx} className="flex items-start text-sm text-muted-foreground">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                              {keyFeatures.length > 5 && (
                                <li className="text-xs text-muted-foreground italic">
                                  + {keyFeatures.length - 5} autres fonctionnalités
                                </li>
                              )}
                            </ul>
                          </div>
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
                >
                  Continuer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Organization Details */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Informations de votre organisation</CardTitle>
              <CardDescription>
                Complétez les informations pour finaliser la configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
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
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OHADA_COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name} ({country.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Espace OHADA - Organisation pour l'Harmonisation en Afrique du Droit des
                    Affaires
                  </p>
                </div>

                {/* Selected Plan Summary */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-semibold text-foreground mb-2">Plan sélectionné</h3>
                  <p className="text-sm text-muted-foreground">
                    <strong>{selectedPlan?.displayName || formData.planName}</strong> - {displayPrice}
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isSubmitting || !formData.organizationName}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Configuration...
                      </>
                    ) : (
                      <>
                        Finaliser la configuration
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

