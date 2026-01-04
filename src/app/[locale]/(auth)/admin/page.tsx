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
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function AdminPage() {
  const t = useTranslations();
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
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
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
            {isSuperAdmin ? t('admin.systemAdmin') : t('admin.title')}
          </h1>
          <p className="text-muted-foreground">
            {isSuperAdmin ? t('admin.systemDescription') : t('admin.description')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleLogout}
          className="flex items-center gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700"
        >
          <LogOut className="h-4 w-4" />
          {t('admin.signOut')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(isSuperAdmin || isAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                {t('admin.organizations')}
              </CardTitle>
              <CardDescription>
                {isSuperAdmin 
                  ? t('admin.manageAllOrganizations')
                  : t('admin.manageOrganizations')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/admin/organizations">{t('admin.manageOrganizationsButton')}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              {t('admin.profilesPermissions')}
            </CardTitle>
            <CardDescription>
              {t('admin.configureProfilePermissions')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/admin/profiles">{t('admin.manageProfiles')}</Link>
            </Button>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  {t('admin.planFeatures')}
                </CardTitle>
                <CardDescription>
                  {t('admin.managePlanFeatures')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/plan-features">{t('admin.configurePlans')}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Navigation className="h-5 w-5 mr-2" />
                  {t('admin.navigationItems')}
                </CardTitle>
                <CardDescription>
                  {t('admin.manageNavigationItems')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/navigation-items">{t('admin.manageItems')}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MousePointerClick className="h-5 w-5 mr-2" />
                  {t('admin.buttons')}
                </CardTitle>
                <CardDescription>
                  {t('admin.manageButtons')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/buttons">{t('admin.manageButtonsButton')}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  {t('admin.subscriptionPlans')}
                </CardTitle>
                <CardDescription>
                  {t('admin.manageSubscriptionPlans')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/plans">{t('admin.managePlans')}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  {t('admin.supportTickets')}
                </CardTitle>
                <CardDescription>
                  {t('admin.manageSupportTickets')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/support-tickets">{t('admin.viewTickets')}</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              {t('admin.users')}
            </CardTitle>
            <CardDescription>
              {t('admin.manageUsers')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/settings/users">{t('admin.manageUsersButton')}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              {t('admin.systemSettings')}
            </CardTitle>
            <CardDescription>
              {t('admin.advancedSystemConfiguration')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              {t('admin.comingSoon')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              {t('admin.integrations')}
            </CardTitle>
            <CardDescription>
              {t('admin.manageExternalIntegrations')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              {t('admin.comingSoon')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.systemInfo')}</CardTitle>
          <CardDescription>{t('admin.systemStats')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('admin.accessType')}</label>
              <div className="text-foreground mt-1">
                {isSuperAdmin ? (
                  <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                    {t('admin.superAdministrator')}
                  </Badge>
                ) : (
                  <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    {t('admin.organizationAdministrator')}
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('admin.permissions')}</label>
              <div className="text-foreground mt-1">
                {isSuperAdmin ? (
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                    {t('admin.unlimitedAccess')}
                  </Badge>
                ) : isAdmin ? (
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                    {t('admin.fullAccess')}
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
                    {t('admin.limitedAccess')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-purple-800 dark:text-purple-300">
                <strong>{t('admin.superAdminInfo')}</strong> {t('admin.superAdminDescription')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


