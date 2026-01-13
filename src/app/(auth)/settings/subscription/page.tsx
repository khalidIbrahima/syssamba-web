'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Crown,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  CreditCard,
  Info,
  ChevronRight,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { usePlan } from '@/hooks/use-plan';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';
import { format, parseISO, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Fetch billing information
async function getBillingInfo() {
  const response = await fetch('/api/subscription/billing', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch billing information');
  }
  return response.json();
}

// Fetch all plans
async function getAllPlans() {
  const response = await fetch('/api/plans', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }
  return response.json();
}

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { canPerformAction, canAccessObject, isLoading: isAccessLoading } = useAccess();
  const { currentUsage, limits: planLimits, plan: currentPlan, definition: planDefinition } = usePlan();
  const { data: billingData, isLoading: billingLoading } = useDataQuery(
    ['billing-info'],
    getBillingInfo
  );
  const { data: plansData, isLoading: plansLoading } = useDataQuery(
    ['all-plans'],
    getAllPlans
  );

  // Handle payment success callback
  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');

    if (success === 'true' && sessionId) {
      // Finalize the upgrade after successful payment
      fetch('/api/subscription/success?session_id=' + sessionId, {
        credentials: 'include',
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            toast.success(data.message || 'Paiement réussi! Plan mis à jour.');
            // Remove query params
            router.replace('/settings/subscription');
            // Invalidate and refetch queries to refresh data without full reload
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['organization-plan'] }),
              queryClient.invalidateQueries({ queryKey: ['billing-info'] }),
            ]);
          } else {
            toast.error(data.error || 'Erreur lors de la finalisation du paiement');
            router.replace('/settings/subscription');
          }
        })
        .catch((error) => {
          console.error('Error finalizing payment:', error);
          toast.error('Erreur lors de la finalisation du paiement');
          router.replace('/settings/subscription');
        });
    } else if (canceled === 'true') {
      toast.info('Paiement annulé');
      router.replace('/settings/subscription');
    }
  }, [searchParams, router, queryClient]);

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  // Check access - must be after all hooks (Rules of Hooks)
  // Subscription management requires settings access and organization edit
  if (!canPerformAction('canViewSettings') &&
      !canAccessObject('Organization', 'edit')) {
    return (
      <AccessDenied
        featureName="Gestion de l'abonnement"
        requiredPermission="canViewSettings"
        icon="lock"
      />
    );
  }

  const subscription = billingData?.subscription;
  // Use real usage data from usePlan hook, fallback to billingData if not available
  const usage = currentUsage || billingData?.usage || { lots: 0, users: 0, extranetTenants: 0 };
  // Use plan limits from usePlan hook, fallback to subscription limits
  const limits = planLimits || subscription?.limits || { lots: -1, users: -1, extranetTenants: -1 };
  const paymentHistory = billingData?.paymentHistory || [];
  const paymentMethod = billingData?.paymentMethod;
  const plans = plansData?.plans || [];
  
  // Merge subscription data with current plan data
  const currentSubscription = subscription ? {
    ...subscription,
    limits: limits,
    planDisplayName: planDefinition?.display_name || subscription.planDisplayName || subscription.planName,
  } : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(parseISO(dateString), 'dd MMMM yyyy', { locale: fr });
  };

  const getUsagePercentage = (used: number, limit: number | null) => {
    if (!limit || limit === -1) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  const isNearLimit = (used: number, limit: number | null) => {
    if (!limit || limit === -1) return false;
    return (used / limit) * 100 >= 75;
  };

  const currentPlanName = currentSubscription?.planName || currentPlan || 'freemium';
  const currentPlanDisplayName = (currentSubscription?.planDisplayName || planDefinition?.display_name || 'Plan Gratuit')?.replace(/0$/, '');
  const monthlyPrice = currentSubscription?.price || 0;
  const billingPeriod = currentSubscription?.billingPeriod || 'monthly';
  const subscriptionStatus = currentSubscription?.status || 'active';
  const nextBillingDate = currentSubscription?.currentPeriodEnd
    ? format(parseISO(currentSubscription.currentPeriodEnd), 'dd MMMM yyyy', { locale: fr })
    : 'N/A';
  const isTrial = currentSubscription?.trialStart && currentSubscription?.trialEnd && 
    new Date(currentSubscription.trialEnd) > new Date();
  const willCancelAtPeriodEnd = currentSubscription?.cancelAtPeriodEnd || false;

  // Filter available plans (exclude current plan)
  const availablePlans = plans.filter((plan: any) => plan.name !== currentPlanName);

  // Check if extranet limit is near
  const extranetLimit = limits.extranetTenants;
  const extranetNearLimit = isNearLimit(usage.extranetTenants, extranetLimit);

  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<{ id: string; name: string; isDowngrade: boolean } | null>(null);
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleUpgradeClick = (planId: string, planName: string, isDowngrade: boolean) => {
    setSelectedPlanForUpgrade({ id: planId, name: planName, isDowngrade });
    setSelectedBillingPeriod(billingPeriod || 'monthly');
    setUpgradeDialogOpen(true);
  };

  const handleUpgrade = async (planId: string, planName: string, isDowngrade: boolean, billingPeriodChoice: 'monthly' | 'yearly') => {
    if (isUpgrading) return; // Prevent double clicks
    
    setIsUpgrading(planId);
    
    try {
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          planId,
          billingPeriod: billingPeriodChoice,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors with details
        if (data.details && Array.isArray(data.details)) {
          toast.error(data.error || 'Erreur lors du changement de plan', {
            description: data.details.join(' '),
            duration: 8000,
          });
        } else {
          toast.error(data.error || 'Erreur lors du changement de plan', {
            description: data.details || 'Une erreur est survenue. Veuillez réessayer.',
            duration: 6000,
          });
        }
        return;
      }

      // Check if payment is required (paid plans)
      if (data.requiresPayment && data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
        return; // Don't reset loading state, page will redirect
      }

      // Success (for free plans)
      toast.success(data.message || 'Plan mis à jour avec succès!', {
        duration: 5000,
      });

      // Refresh data
      window.location.reload(); // Simple reload to refresh all data
    } catch (error: any) {
      console.error('Error upgrading plan:', error);
      toast.error('Erreur lors du changement de plan', {
        description: error.message || 'Une erreur est survenue. Veuillez réessayer.',
        duration: 6000,
      });
      setIsUpgrading(null);
    }
  };

  const handleDowngrade = async (planId: string, planName: string) => {
    // Show confirmation dialog for downgrade
    const confirmed = window.confirm(
      '⚠️ Attention: Le downgrade n\'est pas recommandé.\n\n' +
      'Vos données pourraient être affectées et certaines fonctionnalités peuvent ne plus être disponibles.\n\n' +
      'Êtes-vous sûr de vouloir continuer?'
    );

    if (!confirmed) return;

    await handleUpgrade(planId, planName, true);
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    toast.info('Téléchargement de la facture...');
    // TODO: Implement invoice download
  };

  if (billingLoading || plansLoading) {
    return (
      <div className="space-y-6 min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-background">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Facturation & Abonnement</h1>
        <p className="text-muted-foreground">Gérez votre plan et vos paiements</p>
      </div>

      {/* Current Plan Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <CardTitle>{currentPlanDisplayName}</CardTitle>
              </div>
              <CardDescription>Abonnement {billingPeriod === 'monthly' ? 'mensuel' : 'annuel'} actuel</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(monthlyPrice)}/mois
              </p>
              <Button variant="outline" size="sm" className="mt-2">
                <Download className="h-4 w-4 mr-2" />
                Télécharger facture
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 min-h-screen bg-background">
          {/* Usage Metrics */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Utilisateurs</span>
                <span className="text-sm text-muted-foreground">
                  {usage.users}/{limits.users === -1 ? '∞' : limits.users || 'N/A'}
                </span>
              </div>
              {limits.users && limits.users !== -1 && (
                <Progress
                  value={getUsagePercentage(usage.users, limits.users)}
                  className="h-2"
                />
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Lots gérés</span>
                <span className="text-sm text-muted-foreground">
                  {usage.lots}/{limits.lots === -1 ? '∞' : limits.lots || 'N/A'}
                </span>
              </div>
              {limits.lots && limits.lots !== -1 && (
                <Progress
                  value={getUsagePercentage(usage.lots, limits.lots)}
                  className="h-2"
                  indicatorClassName={getUsageColor(getUsagePercentage(usage.lots, limits.lots))}
                />
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Extranet locataires</span>
                <span className="text-sm text-muted-foreground">
                  {usage.extranetTenants}/{limits.extranetTenants === -1 ? '∞' : limits.extranetTenants || 'N/A'}
                </span>
              </div>
              {limits.extranetTenants && limits.extranetTenants !== -1 && (
                <Progress
                  value={getUsagePercentage(usage.extranetTenants, limits.extranetTenants)}
                  className="h-2"
                  indicatorClassName={getUsageColor(getUsagePercentage(usage.extranetTenants, limits.extranetTenants))}
                />
              )}
            </div>
          </div>

          {/* Upgrade Alert */}
          {extranetNearLimit && extranetLimit && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-1">
                    Limite extranet locataires bientôt atteinte
                  </h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-3">
                    Vous avez activé l'extranet pour {usage.extranetTenants} locataires sur les {extranetLimit} autorisés dans votre plan {currentPlanDisplayName}. Pensez à upgrader vers le plan Syndic pour bénéficier de 200 locataires avec extranet.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600">
                      Upgrader maintenant
                    </Button>
                    <Button variant="ghost" size="sm">
                      Plus tard
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Next Billing Date */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              {isTrial ? (
                <p className="text-sm text-muted-foreground">
                  Période d'essai jusqu'au : {currentSubscription?.trialEnd ? format(parseISO(currentSubscription.trialEnd), 'dd MMMM yyyy', { locale: fr }) : 'N/A'}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {willCancelAtPeriodEnd ? 'Expiration' : 'Prochaine facturation'} : {nextBillingDate}
                </p>
              )}
              {willCancelAtPeriodEnd && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  L'abonnement sera annulé à la fin de la période
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                subscriptionStatus === 'active' ? 'bg-green-500' :
                subscriptionStatus === 'trialing' ? 'bg-blue-500' :
                subscriptionStatus === 'past_due' ? 'bg-orange-500' :
                'bg-red-500'
              )}></div>
              <span className="text-sm font-medium text-foreground">
                {subscriptionStatus === 'active' ? 'Actif' :
                 subscriptionStatus === 'trialing' ? 'Essai' :
                 subscriptionStatus === 'past_due' ? 'En retard' :
                 subscriptionStatus === 'canceled' ? 'Annulé' :
                 subscriptionStatus === 'expired' ? 'Expiré' :
                 subscriptionStatus}
              </span>
            </div>
          </div>

          <div className="text-right">
            <Link href="#" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Modifier le plan
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Plans disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availablePlans.map((plan: any) => {
              const isRecommended = plan.name === 'syndic';
              
              // Determine if this is a downgrade by comparing limits
              const currentLotsLimit = limits.lots === -1 ? Infinity : limits.lots;
              const targetLotsLimit = plan.lotsLimit === -1 ? Infinity : plan.lotsLimit;
              const currentUsersLimit = limits.users === -1 ? Infinity : limits.users;
              const targetUsersLimit = plan.usersLimit === -1 ? Infinity : plan.usersLimit;
              const currentExtranetLimit = limits.extranetTenants === -1 ? Infinity : limits.extranetTenants;
              const targetExtranetLimit = plan.extranetTenantsLimit === -1 ? Infinity : plan.extranetTenantsLimit;
              
              const isDowngrade = targetLotsLimit < currentLotsLimit || 
                                  targetUsersLimit < currentUsersLimit || 
                                  targetExtranetLimit < currentExtranetLimit;
              
              const isLoading = isUpgrading === plan.id;
              
              return (
                <Card key={plan.id} className={cn(
                  'relative',
                  isRecommended && 'border-blue-500 border-2'
                )}>
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white">Recommandé</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.displayName?.replace(/0$/, '') || plan.name}</CardTitle>
                    <p className="text-2xl font-bold text-foreground mt-2">
                      {plan.price ? formatCurrency(parseFloat(plan.price.toString())) : 'Sur mesure'}
                      {plan.price && <span className="text-sm font-normal text-muted-foreground">/mois</span>}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {plan.lotsLimit === -1 ? (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span>Lots illimités</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span>{plan.lotsLimit} lots</span>
                        </div>
                      )}
                      {plan.usersLimit === -1 ? (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span>Utilisateurs illimités</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span>{plan.usersLimit} utilisateurs</span>
                        </div>
                      )}
                      {plan.extranetTenantsLimit === -1 ? (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span>Locataires extranet illimités</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span>{plan.extranetTenantsLimit} locataires extranet</span>
                        </div>
                      )}
                      {plan.name === 'enterprise' && (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span>Marque blanche complète</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span>API & intégrations</span>
                          </div>
                        </>
                      )}
                      {plan.name === 'syndic' && (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span>Domaine personnalisé</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span>Support prioritaire</span>
                          </div>
                        </>
                      )}
                      {plan.name === 'individual' && (
                        <>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <X className="h-4 w-4 text-red-500 dark:text-red-400" />
                            <span>Pas de domaine personnalisé</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span>Support standard</span>
                          </div>
                        </>
                      )}
                    </div>
                    <Button
                      className={cn(
                        'w-full mt-4',
                        isRecommended ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600' : 'bg-muted hover:bg-muted/80 text-foreground',
                        isLoading && 'opacity-50 cursor-not-allowed'
                      )}
                      onClick={() => isDowngrade ? handleDowngrade(plan.id, plan.displayName || plan.name) : handleUpgradeClick(plan.id, plan.displayName || plan.name, false)}
                      disabled={isLoading}
                    >
                      {isLoading 
                        ? 'Traitement...' 
                        : isDowngrade 
                          ? 'Downgrader (non recommandé)' 
                          : `Upgrader vers ${plan.displayName?.replace(/0$/, '') || plan.name}`
                      }
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historique des paiements</CardTitle>
            <Link href="#" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Voir tout
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Facture</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.map((payment: any) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.date)}</TableCell>
                  <TableCell>{payment.description}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                      Payé
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadInvoice(payment.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upgrade Dialog - Frequency Selection */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir la fréquence de facturation</DialogTitle>
            <DialogDescription>
              Sélectionnez la période de facturation pour votre abonnement
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup
              value={selectedBillingPeriod}
              onValueChange={(value) => setSelectedBillingPeriod(value as 'monthly' | 'yearly')}
            >
              <div className="flex items-center space-x-2 space-y-1">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly" className="cursor-pointer flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Mensuel</span>
                    {selectedPlanForUpgrade && (
                      <span className="text-muted-foreground">
                        {(() => {
                          const plan = plans.find((p: any) => p.id === selectedPlanForUpgrade.id);
                          if (plan && plan.price) {
                            return formatCurrency(parseFloat(plan.price.toString()));
                          }
                          return 'Sur devis';
                        })()}/mois
                      </span>
                    )}
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-y-1">
                <RadioGroupItem value="yearly" id="yearly" />
                <Label htmlFor="yearly" className="cursor-pointer flex-1">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">Annuel</span>
                      {selectedPlanForUpgrade && (() => {
                        const plan = plans.find((p: any) => p.id === selectedPlanForUpgrade.id);
                        if (plan && plan.price && plan.yearlyDiscountRate) {
                          return (
                            <Badge variant="secondary" className="ml-2">Économisez {plan.yearlyDiscountRate}%</Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {selectedPlanForUpgrade && (
                      <span className="text-muted-foreground">
                        {(() => {
                          const plan = plans.find((p: any) => p.id === selectedPlanForUpgrade.id);
                          if (plan) {
                            if (plan.priceYearly) {
                              return formatCurrency(parseFloat(plan.priceYearly.toString()));
                            }
                            if (plan.price && plan.yearlyDiscountRate) {
                              const discountMultiplier = 1 - (plan.yearlyDiscountRate / 100);
                              const yearlyPrice = parseFloat(plan.price.toString()) * 12 * discountMultiplier;
                              return formatCurrency(yearlyPrice);
                            }
                            if (plan.price) {
                              const yearlyPrice = parseFloat(plan.price.toString()) * 12;
                              return formatCurrency(yearlyPrice);
                            }
                          }
                          return 'Sur devis';
                        })()}/an
                      </span>
                    )}
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (selectedPlanForUpgrade) {
                  setUpgradeDialogOpen(false);
                  handleUpgrade(
                    selectedPlanForUpgrade.id,
                    selectedPlanForUpgrade.name,
                    selectedPlanForUpgrade.isDowngrade,
                    selectedBillingPeriod
                  );
                }
              }}
            >
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Méthode de paiement</CardTitle>
            <Link href="#" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Modifier
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 border border-border rounded-lg">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">
                **** **** **** {paymentMethod?.last4 || '4532'}
              </p>
              <p className="text-sm text-muted-foreground">
                Expire {paymentMethod?.expiryMonth || 12}/{paymentMethod?.expiryYear || 2027}
              </p>
            </div>
          </div>
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Paiements sécurisés</h4>
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  Nous acceptons les cartes Visa, Mastercard, ainsi que Wave et Orange Money pour les paiements locaux au Sénégal.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

