'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Wallet, ArrowLeft, ArrowRight, Loader2, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDataQuery } from '@/hooks/use-query';

type WalletProvider = 'wave' | 'orange_money' | '';

// Fetch plan details
async function getPlanDetails(planId: string) {
  const response = await fetch('/api/plans');
  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }
  const data = await response.json();
  return data.plans?.find((p: any) => p.id === planId) || null;
}

export default function WalletPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [walletProvider, setWalletProvider] = useState<WalletProvider>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get plan ID, billing period, and provider from URL params
  const planId = searchParams.get('planId');
  const billingPeriod = searchParams.get('billingPeriod') || 'monthly';
  const providerParam = searchParams.get('provider');

  const { data: planDetails } = useDataQuery(
    planId ? ['planDetails', planId] : null,
    () => getPlanDetails(planId!),
    { enabled: !!planId }
  );

  useEffect(() => {
    if (!planId) {
      toast.error('Plan non spécifié');
      router.push('/setup/payment');
    }
  }, [planId, router]);

  // Pre-select wallet provider from URL parameter
  useEffect(() => {
    if (providerParam && (providerParam === 'wave' || providerParam === 'orange_money')) {
      setWalletProvider(providerParam as WalletProvider);
    }
  }, [providerParam]);

  // Calculate price based on billing period
  const price = planDetails
    ? billingPeriod === 'yearly' && planDetails.priceYearly
      ? parseFloat(planDetails.priceYearly.toString())
      : planDetails.price && typeof planDetails.price === 'number'
      ? parseFloat(planDetails.price.toString())
      : 0
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleBack = () => {
    router.push(`/setup/payment?planId=${planId}&billingPeriod=${billingPeriod}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!walletProvider) {
      toast.error('Veuillez sélectionner un fournisseur de wallet');
      return;
    }

    if (!phoneNumber || phoneNumber.trim().length < 9) {
      toast.error('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    if (!planId) {
      toast.error('Plan non spécifié');
      return;
    }

    setIsLoading(true);

    try {
      // Call payment API for wallet payment
      const response = await fetch('/api/subscription/wallet-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          planId,
          billingPeriod,
          paymentMethod: walletProvider,
          phoneNumber: phoneNumber.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du traitement du paiement');
      }

      if (data.success) {
        toast.success('Paiement initié avec succès!');
        // Redirect to success page or dashboard
        router.push('/dashboard?payment=processing');
      } else {
        throw new Error(data.message || 'Échec du paiement');
      }
    } catch (error: any) {
      console.error('Wallet payment error:', error);
      toast.error(error.message || 'Erreur lors du traitement du paiement');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Paiement Mobile Money</h1>
        <p className="text-muted-foreground mt-2">
          Complétez votre paiement via votre wallet mobile
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Détails du paiement</CardTitle>
            <CardDescription>
              Sélectionnez votre wallet et entrez votre numéro de téléphone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Wallet Provider Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Fournisseur de wallet *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Wave */}
                  <Card
                    className={cn(
                      'cursor-pointer transition-all',
                      walletProvider === 'wave'
                        ? 'ring-2 ring-green-600 dark:ring-green-400 border-green-600 dark:border-green-400'
                        : 'hover:border-green-300 dark:hover:border-green-700',
                    )}
                    onClick={() => setWalletProvider('wave')}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
                      <div className="flex-1">
                        <p className="font-semibold">Wave</p>
                        <p className="text-sm text-muted-foreground">Mobile Money</p>
                      </div>
                      {walletProvider === 'wave' && (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      )}
                    </CardContent>
                  </Card>

                  {/* Orange Money */}
                  <Card
                    className={cn(
                      'cursor-pointer transition-all',
                      walletProvider === 'orange_money'
                        ? 'ring-2 ring-orange-600 dark:ring-orange-400 border-orange-600 dark:border-orange-400'
                        : 'hover:border-orange-300 dark:hover:border-orange-700',
                    )}
                    onClick={() => setWalletProvider('orange_money')}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <Wallet className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      <div className="flex-1">
                        <p className="font-semibold">Orange Money</p>
                        <p className="text-sm text-muted-foreground">Mobile Money</p>
                      </div>
                      {walletProvider === 'orange_money' && (
                        <CheckCircle2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone">Numéro de téléphone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="77 123 45 67"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Entrez le numéro de téléphone associé à votre wallet
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isLoading || !walletProvider || !phoneNumber}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    <>
                      Payer maintenant
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé de la commande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {planDetails && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="font-semibold">{planDetails.displayName || planDetails.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Période</p>
                  <p className="font-semibold">
                    {billingPeriod === 'yearly' ? 'Annuel' : 'Mensuel'}
                  </p>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-semibold">Total</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(price)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
