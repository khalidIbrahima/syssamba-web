'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  featureName?: string;
  requiredPlan?: string;
  requiredPermission?: string;
  showUpgradeButton?: boolean;
  icon?: 'shield' | 'lock' | 'crown' | 'alert';
}

export function AccessDenied({
  title,
  message,
  featureName,
  requiredPlan,
  requiredPermission,
  showUpgradeButton = true,
  icon = 'shield',
}: AccessDeniedProps) {
  const router = useRouter();
  const defaultTitle = title || 'Accès non autorisé';
  const defaultMessage = message || 'Vous n\'avez pas accès à cette fonctionnalité.';

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">{defaultTitle}</CardTitle>
          <CardDescription className="mt-2">
            {defaultMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {featureName && (
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-foreground mb-1">
                Fonctionnalité demandée :
              </p>
              <p className="text-sm text-muted-foreground">{featureName}</p>
            </div>
          )}

          <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
            <p className="text-sm text-blue-900 text-center">
              Veuillez contacter votre administrateur pour obtenir l'accès à cette fonctionnalité.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la page précédente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

