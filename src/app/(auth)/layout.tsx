import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AuthContent } from '@/components/layout/auth-content';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { canUserAccessObject } from '@/lib/user-permissions';
import { db } from '@/lib/db';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/sign-in');
  }

  // Get current pathname
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isSetupPage = pathname.includes('/setup');
  const isAdminSelectPage = pathname === '/admin/select-organization' || pathname.startsWith('/admin/select-organization');
  const isAdminPage = pathname.startsWith('/admin'); // Includes /admin and /admin/*
  const isDashboardPage = pathname === '/dashboard' || pathname.startsWith('/dashboard');
  const isSubscriptionInactivePage = pathname === '/subscription-inactive' || pathname.startsWith('/subscription-inactive');
  const isSubscriptionPage = pathname.includes('/subscription') || pathname.includes('/settings/subscription');
  const isAuthPage = pathname.startsWith('/auth');

  // Check organization configuration
  // Allow access to auth pages and setup page without organization checks
  if (!isAuthPage && !isSetupPage && !isAdminSelectPage && !isSubscriptionInactivePage) {
    try {
      const dbUser = await db.selectOne<{
        id: string;
        organization_id: string | null;
      }>('users', {
        eq: { id: user.id },
      });

      if (!dbUser) {
        redirect('/auth/sign-in');
        return;
      }

      // Check if user has System Administrator profile (system admin)
      const dbUserWithProfile = await db.selectOne<{
        id: string;
        profile_id: string | null;
        organization_id: string | null;
      }>('users', {
        eq: { id: user.id },
      });

      // Get profile name to check if user is System Administrator
      let isSystemAdmin = false;
      if (dbUserWithProfile?.profile_id) {
        const profile = await db.selectOne<{
          id: string;
          name: string;
        }>('profiles', {
          eq: { id: dbUserWithProfile.profile_id },
        });
        isSystemAdmin = profile?.name === 'System Administrator';
      }

      // Check super admin status (different from system admin)
      const userIsSuperAdmin = await isSuperAdmin(user.id);

      // Define organization-specific routes that super admins should not access
      const orgSpecificRoutes = [
        '/dashboard',
        '/properties',
        '/units',
        '/tenants',
        '/leases',
        '/payments',
        '/accounting',
        '/tasks',
        '/owners',
        '/settings',
        '/notifications',
      ];
      
      const isOrgSpecificRoute = orgSpecificRoutes.some(route => 
        pathname === route || pathname.startsWith(`${route}/`)
      );

      // Redirect super admins away from organization-specific routes
      if (userIsSuperAdmin && isOrgSpecificRoute && !isAdminPage && !isSubscriptionPage) {
        // Super admin trying to access org routes - always redirect to admin dashboard
        // Super admins manage the system from /admin/dashboard, not org-specific routes
        redirect('/admin/dashboard');
        return;
      }

      if (isSystemAdmin) {
        // System admin: check if organization is configured
        let organizationIsConfigured = false;
        let hasOrganization = false;
        
        if (user.organizationId) {
          hasOrganization = true;
          const organization = await db.selectOne<{
            id: string;
            is_configured: boolean;
          }>('organizations', {
            eq: { id: user.organizationId },
          });

          organizationIsConfigured = organization?.is_configured === true;
        }

        // CRITICAL: If organization is not configured, BLOCK ALL ROUTES except /setup
        // System Admins with unconfigured organizations can ONLY access /setup
        // All other routes (dashboard, properties, settings, etc.) must redirect to /setup
        if (!organizationIsConfigured) {
          // Only allow access to /setup page
          // Block all other routes with immediate redirect
          if (!isSetupPage) {
            // Force redirect to setup - user cannot access any other route
            redirect('/setup');
            return;
          }
          // User is on /setup page - allow access to complete setup
        } else {
          // Organization is configured - allow access to all routes
          // No restrictions for System Admins with configured organizations
        }
      } else if (userIsSuperAdmin) {
        // Super admin (different from system admin) - already handled above
        // If they reach here, they're accessing admin pages or other allowed routes
        // No additional redirects needed - the check above already redirected them from org routes
      } else {
        // Regular user: check if organization is configured
        if (user.organizationId) {
          // Check if organization is configured
          const organization = await db.selectOne<{
            id: string;
            is_configured: boolean;
          }>('organizations', {
            eq: { id: user.organizationId },
          });

          const organizationIsConfigured = organization?.is_configured === true;

          // Block regular users from accessing unconfigured organizations
          if (!organizationIsConfigured) {
            // Regular user cannot access unconfigured organization
            // Redirect to a message page or show error
            if (!isSubscriptionInactivePage) {
              redirect('/subscription-inactive'); // Reuse this page or create a new one
              return;
            }
          }

          // Organization is configured - continue with normal checks
          // Check subscription status for users with organization
          const subscriptions = await db.select<{
            id: string;
            status: string;
          }>('subscriptions', {
            eq: { organization_id: user.organizationId },
            limit: 1,
          });

          const subscription = subscriptions[0];
          const hasActiveSubscription = subscription && 
            (subscription.status === 'active' || subscription.status === 'trialing');

          // Check if user is organization admin (can edit Organization)
          const canEditOrg = await canUserAccessObject(user.id, 'Organization', 'edit');
          
          // If subscription is inactive, handle redirects
          if (!hasActiveSubscription && !isSubscriptionPage) {
            if (canEditOrg) {
              // Admin user: redirect to subscription setup page
              redirect('/settings/subscription');
              return;
            } else {
              // Non-admin user: redirect to inactive subscription page
              redirect('/subscription-inactive');
              return;
            }
          }

          if (canEditOrg) {
            // Organization admin - allow access to all pages including dashboard
            // No redirect needed
          } else {
            // Regular user with configured organization - allow access (permissions checked in page components)
            // User has configured organization - allow access to dashboard and other pages
          }
        } else {
          // Regular user without organization - allow access (no organization to check)
          // They can access the dashboard but won't see organization-specific data
        }
      }
    } catch (error) {
      console.error('Error checking organization:', error);
    }
  }

  return <AuthContent>{children}</AuthContent>;
}
