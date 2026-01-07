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
  TrendingUp,
  BarChart3,
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

// Organization types - plan recommendations will be dynamically determined based on active plans
const organizationTypes = [
  {
    id: 'individual',
    name: 'Particulier',
    description: 'Gestion de votre patrimoine immobilier personnel',
    icon: Home,
    iconColor: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    recommendedPlan: 'freemium', // Default, will be updated based on active plans
    features: [
      'Gestion simple',
      'Suivi des revenus',
      'Rapports de base',
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
    lotsCount: '',
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

  // Function to find a valid plan by name (with fallback)
  const findValidPlanByName = (preferredName: string): any => {
    if (!plans || plans.length === 0) return null;
    
    // Try exact match (case-insensitive)
    let plan = plans.find((p: any) => p.name.toLowerCase() === preferredName.toLowerCase());
    if (plan) return plan;
    
    // Try partial match
    plan = plans.find((p: any) => p.name.toLowerCase().includes(preferredName.toLowerCase()));
    if (plan) return plan;
    
    return null;
  };

  // Function to get a fallback plan (always returns a valid plan from the 3 active plans)
  const getFallbackPlan = (): any => {
    if (!plans || plans.length === 0) return null;
    
    // Only use the 3 active plans: Freemium, Starter, Professional
    const freemium = findValidPlanByName('freemium');
    if (freemium) return freemium;
    
    const starter = findValidPlanByName('entreprise');
    if (starter) return starter;
    
    const professional = findValidPlanByName('professional') || findValidPlanByName('pro');
    if (professional) return professional;
    
    // If none of the 3 active plans exist, return first available plan
    return plans[0];
  };

  // Function to get the plan with the highest lots limit
  const getHighestPlanByLots = (): any => {
    if (!plans || plans.length === 0) return null;
    
    // Get all active plans and sort by lots limit (max_units)
    const sortedPlans = [...plans]
      .filter((p: any) => p.isActive !== false)
      .map((p: any) => ({
        ...p,
        lotsLimit: p.max_units ?? 0,
      }))
      .sort((a: any, b: any) => {
        // Treat null/unlimited as highest
        if (a.lotsLimit === null || a.lotsLimit === -1) return -1;
        if (b.lotsLimit === null || b.lotsLimit === -1) return 1;
        return b.lotsLimit - a.lotsLimit;
      });
    
    return sortedPlans[0] || null;
  };

  // Function to get lot range options - Fixed ranges as specified
  const getLotRangeOptions = () => {
    if (!plans || plans.length === 0) {
      return [];
    }

    const freemiumPlan = findValidPlanByName('freemium');
    const starterPlan = findValidPlanByName('entreprise');
    const professionalPlan = findValidPlanByName('professional') || findValidPlanByName('pro');

    const options = [];

    // Option 1: Pas encore de lots → Freemium
    if (freemiumPlan) {
      options.push({
        id: 'none',
        range: 'Pas encore de lots',
        description: 'Je démarre dans l\'immobilier',
        icon: Sparkles,
        iconColor: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        recommendedPlan: freemiumPlan.name,
        planDisplayName: freemiumPlan.displayName || freemiumPlan.name,
        minLots: 0,
        maxLots: 0,
      });
    }

    // Option 2: 10 à 50 lots → Starter (supports up to 100 lots)
    if (starterPlan) {
      options.push({
        id: '10-50',
        range: '10 à 50 lots',
        description: 'Agence / SCI moyenne',
        icon: Building2,
        iconColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        recommendedPlan: starterPlan.name,
        planDisplayName: starterPlan.displayName || starterPlan.name,
        minLots: 10,
        maxLots: 50,
      });
    }

    // Option 3: 50 à 150 lots → Starter ou Professional selon disponibilité
    const planFor50_150 = starterPlan || professionalPlan;
    if (planFor50_150) {
      options.push({
        id: '50-150',
        range: '50 à 150 lots',
        description: 'Grande agence / SCI importante',
        icon: Building2,
        iconColor: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        recommendedPlan: professionalPlan?.name || starterPlan?.name || '',
        planDisplayName: professionalPlan?.displayName || starterPlan?.displayName || '',
        minLots: 50,
        maxLots: 150,
      });
    }

    // Option 4: Sur devis (plus de 150 lots) → Professional ou solution sur mesure
    const highestPlan = professionalPlan || starterPlan || freemiumPlan;
    if (highestPlan) {
      options.push({
        id: 'custom',
        range: 'Sur devis',
        description: 'Enterprise / Institutionnel',
        icon: TrendingUp,
        iconColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        recommendedPlan: highestPlan.name,
        planDisplayName: 'Solution sur mesure',
        minLots: 151,
        maxLots: null,
        isCustom: true,
        exceedsPlanLimit: true, // Flag to show warning
      });
    }

    return options;
  };

  // Function to get recommended plan based on lots count
  const getRecommendedPlanByLots = (lotsCount: string): string | null => {
    if (!lotsCount || !plans || plans.length === 0) return null;

    // Handle range IDs like "10-50", "50-150", "custom", or "none"
    const lotOptions = getLotRangeOptions();
    const matchingOption = lotOptions.find(option => option.id === lotsCount);
    if (matchingOption) {
      return matchingOption.recommendedPlan || null;
    }

    // Handle numeric count (fallback for direct number input)
    const count = parseInt(lotsCount);
    if (isNaN(count)) return null;

    // Match based on numeric ranges
    const numericMatch = lotOptions.find(option => {
      if (option.id === 'none') return count === 0;
      if (option.id === 'custom' || option.isCustom) return count > 150;
      if (option.id === '10-50') return count >= 10 && count <= 50;
      if (option.id === '50-150') return count > 50 && count <= 150;
      // Fallback: check min/max if available
      if (option.minLots !== undefined && option.maxLots !== undefined && option.maxLots !== null) {
        return count >= option.minLots && count <= option.maxLots;
      }
      if (option.minLots !== undefined && option.maxLots === null) {
        return count > option.minLots;
      }
      return false;
    });

    // If no matching option found, return the highest plan available
    if (!numericMatch) {
      const highestPlan = getHighestPlanByLots();
      return highestPlan?.name || null;
    }

    return numericMatch?.recommendedPlan || null;
  };

  // Function to get recommended plan based on organization type and available ACTIVE plans
  // Uses the 3 active plans: Freemium (7 lots, 1 user, 7 extranet), Starter (100 lots, 3 users, 150 extranet), Professional (200 lots, 10 users, 250 extranet)
  // Recommendations are based on actual plan limits from the database
  // If lotsCount is provided, it takes priority over organization type
  const getRecommendedPlanName = (orgTypeId: string, lotsCount?: string): string => {
    if (!plans || plans.length === 0) {
      return 'freemium'; // Fallback
    }

    // If lots count is provided, use it to determine the plan
    if (lotsCount) {
      const planByLots = getRecommendedPlanByLots(lotsCount);
      if (planByLots) {
        return planByLots;
      }
    }

    // Filter only active plans (should already be filtered by API, but double-check)
    const activePlans = plans.filter((p: any) => p.isActive !== false);

    // Map of available active plans (Freemium, Starter, Professional)
    const availablePlans = {
      freemium: findValidPlanByName('freemium'),
      starter: findValidPlanByName('starter'),
      professional: findValidPlanByName('professional') || findValidPlanByName('pro'),
    };

    // Get the highest plan available (for cases where needs exceed all plan limits)
    const highestPlan = getHighestPlanByLots();

    let recommendedPlan: any = null;

    switch (orgTypeId) {
      case 'individual':
        // For individuals, recommend Freemium (7 lots, 1 user, 7 extranet tenants)
        // Perfect for personal property management
        recommendedPlan = availablePlans.freemium;
        break;

      case 'agency':
        // For agencies, recommend Starter (100 lots, 3 users, 150 extranet tenants)
        // Good for small to medium agencies managing multiple properties
        // If Starter doesn't exist, fallback to Professional for larger agencies
        recommendedPlan = availablePlans.starter || availablePlans.professional || highestPlan;
        break;

      case 'sci':
        // For SCI, recommend Professional (200 lots, 10 users, 250 extranet tenants)
        // Better suited for larger organizations with more complex needs
        // If Professional doesn't exist, fallback to Starter
        recommendedPlan = availablePlans.professional || availablePlans.starter || highestPlan;
        break;

      case 'syndic':
        // For syndic, recommend Starter (100 lots, 3 users, 150 extranet tenants)
        // Good starting point for managing multiple residences
        // Can upgrade to Professional if managing larger complexes
        recommendedPlan = availablePlans.starter || availablePlans.professional || highestPlan;
        break;

      default:
        recommendedPlan = null;
    }

    // Always return a valid plan from the active plans
    // Priority: recommended plan -> highest plan (for needs exceeding limits) -> freemium -> starter -> professional -> first available
    const finalPlan = recommendedPlan || highestPlan || availablePlans.freemium || availablePlans.starter || availablePlans.professional || activePlans[0];
    return finalPlan?.name || 'freemium';
  };

  // Update recommended plan when organization type, lots count, or plans change
  useEffect(() => {
    if (plans && plans.length > 0) {
      const recommendedPlanName = getRecommendedPlanName(formData.organizationType, formData.lotsCount);
      // Verify the plan exists before setting it
      const planExists = plans.some((p: any) => p.name === recommendedPlanName);
      if (planExists) {
        setFormData(prev => ({ ...prev, planName: recommendedPlanName }));
      } else {
        // If recommended plan doesn't exist, use fallback
        const fallbackPlan = getFallbackPlan();
        if (fallbackPlan) {
          setFormData(prev => ({ ...prev, planName: fallbackPlan.name }));
        }
      }
    }
  }, [formData.organizationType, formData.lotsCount, plans]);

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
      
      // Get selected plan to get its ID
      const selectedPlanForPayment = plans?.find((p: any) => p.name === formData.planName);
      
      // If payment is required and we're on payment step, process payment
      if (isPaymentRequired() && currentStep === 3 && paymentMethod && selectedPlanForPayment?.id) {
        setIsProcessingPayment(true);
        
        const paymentResponse = await fetch('/api/organization/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId: selectedPlanForPayment.id,
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
      
      // Redirect to dashboard with custom subdomain if available
      const redirectUrl = setupData.subdomainUrl 
        ? `${setupData.subdomainUrl}/dashboard`
        : (setupData.redirectTo || '/dashboard');
      window.location.href = redirectUrl;
    } catch (error: any) {
      console.error('Setup error:', error);
      toast.error(error.message || 'Erreur lors de la configuration');
    } finally {
      setIsSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  // Helper function to get setup steps info based on active plans
  const getSetupStepsInfo = () => {
    if (!plans || plans.length === 0) {
      return {
        totalActivePlans: 0,
        plansInfo: [],
        hasFreePlan: false,
        hasPaidPlans: false,
      };
    }

    const activePlans = plans.filter((p: any) => p.isActive !== false);
    const freemiumPlan = findValidPlanByName('freemium');
    const starterPlan = findValidPlanByName('starter');
    const professionalPlan = findValidPlanByName('professional') || findValidPlanByName('pro');

    return {
      totalActivePlans: activePlans.length,
      plansInfo: [
        freemiumPlan && {
          name: freemiumPlan.displayName || freemiumPlan.name,
          lots: freemiumPlan.max_units ?? 7,
          users: freemiumPlan.max_users ?? 1,
          extranetTenants: freemiumPlan.extranet_tenants_limit ?? 7,
          price: 'Gratuit',
        },
        starterPlan && {
          name: starterPlan.displayName || starterPlan.name,
          lots: starterPlan.max_units ?? 100,
          users: starterPlan.max_users ?? 3,
          extranetTenants: starterPlan.extranet_tenants_limit ?? 150,
          price: starterPlan.price === 'custom' || starterPlan.price === null || typeof starterPlan.price !== 'number'
            ? 'Sur devis'
            : `${starterPlan.price.toLocaleString('fr-FR')} FCFA/mois`,
        },
        professionalPlan && {
          name: professionalPlan.displayName || professionalPlan.name,
          lots: professionalPlan.max_units ?? 200,
          users: professionalPlan.max_users ?? 10,
          extranetTenants: professionalPlan.extranet_tenants_limit ?? 250,
          price: professionalPlan.price === 'custom' || professionalPlan.price === null || typeof professionalPlan.price !== 'number'
            ? 'Sur devis'
            : `${professionalPlan.price.toLocaleString('fr-FR')} FCFA/mois`,
        },
      ].filter(Boolean),
      hasFreePlan: !!freemiumPlan,
      hasPaidPlans: !!(starterPlan || professionalPlan),
    };
  };

  const selectedPlan = plans?.find((p: any) => p.name === formData.planName);
  const recommendedPlan = plans && plans.length > 0 
    ? getRecommendedPlanName(formData.organizationType, formData.lotsCount)
    : (organizationTypes.find(t => t.id === formData.organizationType)?.recommendedPlan || 'freemium');
  const price = selectedPlan?.price;
  const displayPrice =
    price === 'custom' || price === null || price === undefined
      ? 'Sur devis'
      : formData.billingPeriod === 'yearly' && typeof price === 'number'
      ? `${Math.round(price * 12 * 0.8).toLocaleString('fr-FR')} FCFA/an`
      : typeof price === 'number'
      ? `${price.toLocaleString('fr-FR')} FCFA/mois`
      : 'Sur devis';
  
  const setupStepsInfo = getSetupStepsInfo();

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
                Commençons par les informations essentielles. 
                {!plansLoading && setupStepsInfo.totalActivePlans > 0 && (
                  <> Nous vous recommanderons le plan le plus adapté parmi les {setupStepsInfo.totalActivePlans} plan{setupStepsInfo.totalActivePlans > 1 ? 's' : ''} disponible{setupStepsInfo.totalActivePlans > 1 ? 's' : ''}.</>
                )}
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
                  <p className="text-sm text-muted-foreground mb-4">
                    Cette information nous aide à recommander le plan le plus adapté
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {organizationTypes.map((type) => {
                      const Icon = type.icon;
                      const isSelected = formData.organizationType === type.id;
                      
                      // Get recommended plan for this organization type
                      const recommendedPlanName = plans && plans.length > 0
                        ? getRecommendedPlanName(type.id, formData.lotsCount)
                        : type.recommendedPlan;
                      let recommendedPlan = plans?.find((p: any) => p.name === recommendedPlanName);
                      
                      // If recommended plan doesn't exist, use fallback
                      if (!recommendedPlan && plans && plans.length > 0) {
                        recommendedPlan = getFallbackPlan();
                      }
                      
                      // Format price
                      const planPrice = recommendedPlan?.price;
                      const displayPrice = planPrice === 'custom' || planPrice === null || planPrice === undefined
                        ? 'Sur devis'
                        : typeof planPrice === 'number'
                        ? `${new Intl.NumberFormat('fr-FR').format(planPrice)} XOF/mois`
                        : planPrice;
                      
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
                          {(type as any).recommended && (
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
                            
                            {/* Recommended Plan Info */}
                            {recommendedPlan && (
                              <div className="mb-4 p-3 bg-background/50 rounded-lg border border-border">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Plan recommandé</p>
                                    <p className="text-sm font-semibold text-foreground">
                                      {recommendedPlan.displayName || recommendedPlan.name}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-muted-foreground mb-1">À partir de</p>
                                    <p className="text-sm font-semibold text-foreground">
                                      {displayPrice}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
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

                {/* Number of Lots Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-blue-600 dark:bg-blue-500 rounded-lg p-3">
                      <Building2 className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <Label className="text-base font-semibold text-center block">
                    Combien de lots gérez-vous actuellement ?
                  </Label>
                  <p className="text-sm text-muted-foreground text-center mb-6">
                    Cette information nous aide à recommander le plan le plus adapté
                  </p>
                  
                  {plansLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getLotRangeOptions().map((option) => {
                        const Icon = option.icon;
                        const isSelected = formData.lotsCount === option.id;
                        const recommendedPlan = plans?.find((p: any) => p.name === option.recommendedPlan);
                        const planPrice = recommendedPlan?.price;
                        const displayPrice = planPrice === 'custom' || planPrice === null || planPrice === undefined
                          ? 'Sur devis'
                          : typeof planPrice === 'number'
                          ? `${new Intl.NumberFormat('fr-FR').format(planPrice)} FCFA/mois`
                          : planPrice === 0 || planPrice === '0'
                          ? 'Gratuit'
                          : planPrice;

                        return (
                          <Card
                            key={option.id}
                            className={cn(
                              'cursor-pointer transition-all relative',
                              isSelected
                                ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 shadow-lg'
                                : 'hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md',
                              option.bgColor
                            )}
                            onClick={() => {
                              setFormData({ ...formData, lotsCount: option.id });
                            }}
                          >
                            {isSelected && (
                              <div className="absolute -top-2 -right-2">
                                <div className="bg-blue-600 rounded-full p-1">
                                  <CheckCircle2 className="h-4 w-4 text-white" />
                                </div>
                              </div>
                            )}
                            <CardContent className="p-6">
                              <div className="flex items-start gap-4 mb-4">
                                <div className={cn('p-3 rounded-lg', option.bgColor)}>
                                  <Icon className={cn('h-6 w-6', option.iconColor)} />
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-bold text-foreground mb-1">
                                    {option.range}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">{option.description}</p>
                                </div>
                              </div>
                              
                              {/* Recommended Plan Info */}
                              {recommendedPlan && (
                                <div className="mt-4 pt-4 border-t border-border">
                                  <p className="text-xs text-muted-foreground mb-1">Plan recommandé</p>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className={cn(
                                      'text-sm font-semibold',
                                      option.isCustom ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                                    )}>
                                      {option.planDisplayName}
                                    </p>
                                    {!option.isCustom && displayPrice !== 'Sur devis' && (
                                      <p className="text-xs text-muted-foreground">
                                        {displayPrice}
                                      </p>
                                    )}
                                  </div>
                                  {/* Warning if exceeds plan limit */}
                                  {option.exceedsPlanLimit && recommendedPlan && (
                                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs">
                                      <p className="text-amber-800 dark:text-amber-300">
                                        <strong>Note:</strong> Le plan {recommendedPlan.displayName || recommendedPlan.name} supporte jusqu'à {recommendedPlan.max_units ?? 0} lots. 
                                        Pour {option.range.toLowerCase()}, contactez-nous pour une solution sur mesure.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
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
                {!plansLoading && setupStepsInfo.totalActivePlans > 0 ? (
                  <>
                    {setupStepsInfo.totalActivePlans} plan{setupStepsInfo.totalActivePlans > 1 ? 's' : ''} disponible{setupStepsInfo.totalActivePlans > 1 ? 's' : ''} : 
                    {setupStepsInfo.plansInfo.map((plan: any, idx: number) => (
                      <span key={idx}>
                        {' '}{plan.name}
                        {idx < setupStepsInfo.plansInfo.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </>
                ) : (
                  'Sélectionnez le plan adapté à vos besoins'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Recommended Plan Banner */}
              {recommendedPlan && (() => {
                const selectedPlanData = plans?.find((p: any) => p.name === recommendedPlan);
                const lotOptions = getLotRangeOptions();
                const selectedLotOption = formData.lotsCount 
                  ? lotOptions.find(opt => opt.id === formData.lotsCount)
                  : null;
                const exceedsLimit = selectedLotOption?.exceedsPlanLimit || false;
                const planLimit = selectedPlanData?.max_units ?? 0;

                return (
                  <div className="space-y-3 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-900 dark:text-blue-300">
                        <strong>Recommandation :</strong> 
                        {formData.lotsCount ? (
                          <>
                            {' '}Basé sur le nombre de lots que vous gérez, nous vous recommandons le plan{' '}
                            <strong>
                              {selectedPlanData?.displayName || recommendedPlan}
                            </strong>
                            .
                          </>
                        ) : (
                          <>
                            {' '}Pour une organisation de type{' '}
                            <strong>{organizationTypes.find(t => t.id === formData.organizationType)?.name}</strong>,
                            nous vous recommandons le plan{' '}
                            <strong>
                              {selectedPlanData?.displayName || recommendedPlan}
                            </strong>
                            .
                          </>
                        )}
                        {!exceedsLimit && ' Ce plan est parfaitement adapté à vos besoins !'}
                      </p>
                    </div>
                    {exceedsLimit && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          <strong>⚠️ Important :</strong> Le plan {selectedPlanData?.displayName || recommendedPlan} supporte jusqu'à {planLimit} lots. 
                          {selectedLotOption && ` Vous avez sélectionné "${selectedLotOption.range}", ce qui dépasse cette limite.`}
                          {' '}Veuillez nous contacter pour discuter d'une solution sur mesure adaptée à vos besoins.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

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
                                {plan.max_units === null || plan.max_units === undefined ? 'Illimités' : plan.max_units}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Utilisateurs</span>
                              <span className="font-semibold text-foreground">
                                {plan.max_users === null || plan.max_users === undefined ? 'Illimités' : plan.max_users}
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
