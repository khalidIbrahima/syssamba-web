'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Mail, Phone, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function SubscriptionInactivePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-2xl">Abonnement inactif</CardTitle>
          <CardDescription className="text-base mt-2">
            L'accès à l'application est temporairement suspendu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Votre abonnement n'est pas actif.</strong> Pour réactiver l'accès à l'application, 
              veuillez contacter l'administrateur de votre organisation.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Que faire maintenant ?</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Contactez votre administrateur</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Seul un administrateur de votre organisation peut réactiver l'abonnement. 
                    Contactez-le pour résoudre ce problème.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Informations nécessaires</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Informez votre administrateur que l'abonnement de l'organisation doit être réactivé 
                    pour que vous puissiez accéder à nouveau à l'application.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/auth/sign-out'}
                className="w-full sm:w-auto"
              >
                Se déconnecter
              </Button>
              <Button
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto"
              >
                Actualiser la page
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




