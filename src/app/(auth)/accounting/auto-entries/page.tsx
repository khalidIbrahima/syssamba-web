'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';

export default function AutoEntriesPage() {
  const { canAccessFeature, canAccessObject } = useAccess();

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canAccessFeature('accounting_sycoda_basic', 'canViewAccounting') && 
      !canAccessObject('JournalEntry', 'read')) {
    return (
      <AccessDenied
        featureName="Écritures automatiques"
        requiredPlan="premium"
        icon="lock"
      />
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/accounting">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Écritures Automatiques</h1>
          <p className="text-gray-600 mt-1">
            Configuration des écritures comptables automatiques
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Écritures automatiques</CardTitle>
          <CardDescription>
            Configurez les règles pour générer automatiquement des écritures comptables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-gray-600 mb-6">
              Cette fonctionnalité sera bientôt disponible.
            </p>
            <p className="text-sm text-gray-500">
              Vous pourrez configurer des règles pour générer automatiquement des écritures
              lors de l'enregistrement de paiements, de loyers, de charges, etc.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

