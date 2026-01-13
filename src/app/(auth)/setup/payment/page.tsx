'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, CreditCard, Wallet, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PaymentMethod = 'stripe' | 'wallet' | '';

export default function SetupPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [isLoading, setIsLoading] = useState(false);

  // Get plan ID and billing period from URL params
  const planId = searchParams.get('planId');
  const billingPeriod = searchParams.get('billingPeriod') || 'monthly';

  useEffect(() => {
    // If no planId, redirect back to setup
    if (!planId) {
      toast.error('Plan non spécifié');
      router.push('/setup');
    }
  }, [planId, router]);

  const handleContinue = async () => {
    if (!paymentMethod) {
      toast.error('Veuillez sélectionner une méthode de paiement');
      return;
    }

    if (!planId) {
      toast.error('Plan non spécifié');
      return;
    }

    setIsLoading(true);

    try {
      if (paymentMethod === 'stripe') {
        // Redirect to Stripe Checkout
        const response = await fetch('/api/subscription/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            planId,
            billingPeriod,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erreur lors de la création de la session de paiement');
        }

        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error('URL de paiement non reçue');
        }
      } else if (paymentMethod === 'wallet') {
        // Redirect to wallet payment page
        router.push(`/setup/payment/wallet?planId=${planId}&billingPeriod=${billingPeriod}`);
      }
    } catch (error: any) {
      console.error('Payment method selection error:', error);
      toast.error(error.message || 'Erreur lors de la sélection de la méthode de paiement');
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Choisir la méthode de paiement</h1>
        <p className="text-muted-foreground mt-2">
          Sélectionnez votre méthode de paiement préférée pour finaliser votre abonnement
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Méthode de paiement</CardTitle>
          <CardDescription>
            Choisissez comment vous souhaitez payer votre abonnement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Carte bancaire */}
            <Card
              className={cn(
                'cursor-pointer transition-all',
                paymentMethod === 'stripe'
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400'
                  : 'hover:border-blue-300 dark:hover:border-blue-700',
              )}
              onClick={() => setPaymentMethod('stripe')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <CreditCard className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <p className="font-semibold text-lg">Carte bancaire</p>
                  <p className="text-sm text-muted-foreground">Visa, Mastercard</p>
                </div>
                {paymentMethod === 'stripe' && (
                  <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                )}
              </CardContent>
            </Card>

            {/* Wallet (Mobile Money) */}
            <Card
              className={cn(
                'cursor-pointer transition-all',
                paymentMethod === 'wallet'
                  ? 'ring-2 ring-green-600 dark:ring-green-400 border-green-600 dark:border-green-400'
                  : 'hover:border-green-300 dark:hover:border-green-700',
              )}
              onClick={() => setPaymentMethod('wallet')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <Wallet className="h-8 w-8 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="font-semibold text-lg">Mobile Money</p>
                  <p className="text-sm text-muted-foreground">Wave, Orange Money</p>
                </div>
                {paymentMethod === 'wallet' && (
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Security Note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-400">
              <strong>🔒 Paiement sécurisé:</strong> Vos informations de paiement sont cryptées et sécurisées.
              Nous ne stockons pas vos données de carte bancaire.
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              onClick={handleContinue}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading || !paymentMethod}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  Continuer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
