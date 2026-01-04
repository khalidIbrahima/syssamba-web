'use client';

import { PageLoader } from '@/components/ui/page-loader';
import { useDataQuery } from '@/hooks/use-query';
import { usePageAccess } from '@/hooks/use-page-access';
import { useUser } from '@/hooks/use-user';
import { AccountantDashboard } from '@/components/dashboard/accountant-dashboard';
import { AgentDashboard } from '@/components/dashboard/agent-dashboard';
import { OwnerDashboard } from '@/components/dashboard/owner-dashboard';
import { ViewerDashboard } from '@/components/dashboard/viewer-dashboard';

// Fetch dashboard data from API
async function getDashboardData() {
  const response = await fetch('/api/dashboard', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
}

export default function DashboardPage() {
  const { isLoading: isAccessLoading } = usePageAccess();
  const { user } = useUser();
  const { data, isLoading } = useDataQuery(['dashboard-data'], getDashboardData);

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  // Dashboard is accessible to all users with organization
  // Permissions are checked at the sidebar level to show only accessible items
  // No permission check needed here - dashboard is always visible

  if (isLoading) {
    return (
      <div className="space-y-6 min-h-screen bg-background">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Get profile from data
  const profileName = data?.profile || 'Viewer';

  // Render profile-specific dashboard
  const renderDashboard = () => {
    switch (profileName) {
      case 'Accountant':
      case 'System Administrator':
        return <AccountantDashboard data={data} />;
      case 'Agent':
        return <AgentDashboard data={data} />;
      case 'Owner':
        return <OwnerDashboard data={data} />;
      case 'Viewer':
      default:
        return <ViewerDashboard data={data} />;
    }
  };

  return (
    <div className="space-y-6 min-h-screen bg-background">
      {/* Welcome Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Bienvenue, {user?.firstName || 'Utilisateur'} 👋
        </h2>
        <p className="text-muted-foreground">
          {profileName === 'Accountant' && 'Vue d\'ensemble financière et comptable'}
          {profileName === 'System Administrator' && 'Vue d\'ensemble complète de votre organisation'}
          {profileName === 'Agent' && 'Vue d\'ensemble opérationnelle'}
          {profileName === 'Owner' && 'Vue d\'ensemble de vos propriétés'}
          {profileName === 'Viewer' && 'Vue d\'ensemble en lecture seule'}
        </p>
      </div>

      {renderDashboard()}
    </div>
  );
}
