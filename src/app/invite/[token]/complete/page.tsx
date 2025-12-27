'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import { toast } from 'sonner';

export default function InviteCompletePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const token = params.token as string;
  const [isProcessing, setIsProcessing] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const acceptInvitation = async () => {
      try {
        setIsProcessing(true);
        
        const response = await fetch(`/api/invite/${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ userId: user.id }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to accept invitation');
        }

        setIsComplete(true);
        toast.success('Invitation acceptée avec succès !');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (error) {
        console.error('Error accepting invitation:', error);
        toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'acceptation de l\'invitation');
        setIsProcessing(false);
      }
    };

    acceptInvitation();
  }, [user, isLoaded, token, router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {isComplete ? 'Invitation acceptée !' : 'Traitement de l\'invitation...'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isProcessing && !isComplete ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <p className="text-center text-gray-600">
                Acceptation de l'invitation en cours...
              </p>
            </div>
          ) : isComplete ? (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-center text-gray-600">
                Votre invitation a été acceptée avec succès. Redirection vers le tableau de bord...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Button onClick={() => router.push('/dashboard')}>
                Aller au tableau de bord
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

