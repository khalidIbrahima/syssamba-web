'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Shield,
  Users,
  Settings,
  Globe,
  LogOut,
  Zap,
  DollarSign,
  MessageSquare,
  Navigation,
  MousePointerClick,
} from 'lucide-react';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { canPerformAction, canAccessObject, isLoading: isAccessLoading } = useAccess();
  const { isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/sign-in');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Wait for data to load before checking access
  if (isAccessLoading || isSuperAdminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Check if user has admin access (can edit Organization)
  const isAdmin = canAccessObject('Organization', 'edit');

  if (!isAdmin && !isSuperAdmin) {
    return (
      <AccessDenied
        featureName="Administration"
        requiredPermission="canEditOrganization"
        icon="lock"
      />
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isSuperAdmin ? 'Administration Système' : 'Administration'}
          </h1>
          <p className="text-muted-foreground">
            {isSuperAdmin
              ? 'Gestion globale du système - Accès illimité à toutes les fonctionnalités'
              : 'Gestion système et configuration avancée'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleLogout}
          className="flex items-center gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(isSuperAdmin || isAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Organisations
              </CardTitle>
              <CardDescription>
                {isSuperAdmin 
                  ? 'Gérez toutes les organisations du système'
                  : 'Gérez les organisations (accès limité aux données sensibles)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/admin/organizations">Gérer les organisations</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Profils & Permissions
            </CardTitle>
            <CardDescription>
              Configurez les permissions et accès pour chaque profil utilisateur
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/admin/profiles">Gérer les profils</Link>
            </Button>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  Fonctionnalités par Plan
                </CardTitle>
                <CardDescription>
                  Gérez les fonctionnalités disponibles pour chaque plan d'abonnement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/plan-features">Configurer les plans</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Navigation className="h-5 w-5 mr-2" />
                  Items de Navigation
                </CardTitle>
                <CardDescription>
                  Gérez les éléments de navigation de la sidebar par profil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/navigation-items">Gérer les items</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MousePointerClick className="h-5 w-5 mr-2" />
                  Boutons
                </CardTitle>
                <CardDescription>
                  Gérez les boutons et leurs permissions par profil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/buttons">Gérer les boutons</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Plans d'Abonnement
                </CardTitle>
                <CardDescription>
                  Gérez les plans, leurs prix et leurs limites
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/plans">Gérer les plans</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Tickets de Support
                </CardTitle>
                <CardDescription>
                  Gérez tous les tickets de support créés par les organisations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/support-tickets">Voir les tickets</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Utilisateurs
            </CardTitle>
            <CardDescription>
              Gérez les utilisateurs et leurs rôles
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
              <Settings className="h-5 w-5 mr-2" />
              Paramètres système
            </CardTitle>
            <CardDescription>
              Configuration avancée du système
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Bientôt disponible
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Intégrations
            </CardTitle>
            <CardDescription>
              Gérer les intégrations externes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Bientôt disponible
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations système</CardTitle>
          <CardDescription>Statistiques et informations sur l'administration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type d'accès</label>
              <div className="text-foreground mt-1">
                {isSuperAdmin ? (
                  <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                    Super Administrateur
                  </Badge>
                ) : (
                  <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    Administrateur Organisation
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Permissions</label>
              <div className="text-foreground mt-1">
                {isSuperAdmin ? (
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                    Accès illimité
                  </Badge>
                ) : isAdmin ? (
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                    Accès complet
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
                    Accès limité
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-purple-800 dark:text-purple-300">
                <strong>Super Administrateur :</strong> Vous avez un accès illimité à toutes les fonctionnalités du système.
                Aucune limite ne s'applique aux utilisateurs, profils, permissions ou organisations que vous gérez.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


