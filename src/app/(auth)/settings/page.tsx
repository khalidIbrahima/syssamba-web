'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Users, CreditCard, Globe, Shield, Bell, UserCog } from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';
import { usePageAccess } from '@/hooks/use-page-access';

export default function SettingsPage() {
  const { canPerformAction, isLoading: isAccessLoading } = usePageAccess();
  const { plan, limits } = usePlan();

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  // Check access using same criteria as sidebar
  if (!canPerformAction('canViewSettings')) {
    return (
      <AccessDenied
        featureName="Paramètres"
        requiredPermission="canViewSettings"
        icon="lock"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-600">Gestion des utilisateurs et configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Utilisateurs
            </CardTitle>
            <CardDescription>
              Gérez les accès et rôles ({limits.users - 1} places restantes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/settings/users">Gérer les utilisateurs</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Profils & Permissions
            </CardTitle>
            <CardDescription>
              Configurez les permissions et accès pour chaque profil
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/admin/profiles">Gérer les profils</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Abonnement
            </CardTitle>
            <CardDescription>
              Plan actuel: <Badge>{plan}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link href="/settings/subscription">Changer de plan</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Domaine extranet
            </CardTitle>
            <CardDescription>
              Personnalisez l'accès locataire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled={plan === 'freemium'}>
              Configurer domaine
            </Button>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Sécurité
            </CardTitle>
            <CardDescription>
              Mots de passe et authentification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Paramètres sécurité
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notifications
            </CardTitle>
            <CardDescription>
              Préférences de communication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Configurer notifications
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Intégrations
            </CardTitle>
            <CardDescription>
              APIs et services externes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Gérer intégrations
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'organisation</CardTitle>
          <CardDescription>Détails de votre compte SYS SAMBA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Nom de l'organisation</label>
              <p className="text-gray-900">Ma Société Immobilière</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Plan actuel</label>
              <p className="text-gray-900 capitalize">{plan}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Limite lots</label>
              <p className="text-gray-900">{limits.lots === -1 ? 'Illimité' : limits.lots}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Utilisateurs actifs</label>
              <p className="text-gray-900">1 / {limits.users}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
