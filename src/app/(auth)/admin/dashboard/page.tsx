'use client';

import { SuperAdminDashboard } from '@/components/dashboard/super-admin-dashboard';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { PageLoader } from '@/components/ui/page-loader';
import { AccessDenied } from '@/components/ui/access-denied';

export default function AdminDashboardPage() {
  const { isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();

  if (isSuperAdminLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  if (!isSuperAdmin) {
    return (
      <AccessDenied
        featureName="Dashboard Super Admin"
        requiredPermission="Super-admin access"
        icon="lock"
      />
    );
  }

  return <SuperAdminDashboard />;
}

