import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AuthContent } from '@/components/layout/auth-content';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { canUserAccessObject } from '@/lib/user-permissions';
import { db } from '@/lib/db';

// Force dynamic rendering for authenticated routes (uses cookies/headers)
export const dynamic = 'force-dynamic';

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

  // CRITICAL: Check setup page access FIRST - must block if org is already configured
  if (isSetupPage) {
    try {
      const dbUser = await db.selectOne<{
        id: string;
        organization_id: string | null;
      }>('users', {
        eq: { id: user.id },
      });

      if (dbUser?.organization_id) {
        // Check if organization is configured
        const organization = await db.selectOne<{
          id: string;
          is_configured: boolean;
        }>('organizations', {
          eq: { id: dbUser.organization_id },
        });

        // If organization is already configured, redirect away from setup
        if (organization?.is_configured === true) {
          redirect('/dashboard');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking organization configuration for setup page:', error);
    }
  }

  // Check organization configuration
  // Allow access to auth pages and setup page without organization checks (setup is checked above)
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

      // CRITICAL: Check organization configuration FIRST for ALL users (including System Admins)
      // Only Super Admins (platform-level) can bypass this check
      // System Administrators (organization-level admins) MUST have configured organization
      const userOrganizationId = dbUser?.organization_id;
      
      // Check organization configuration status - explicitly check for true
      let organizationIsConfigured = false;
      let organization = null;
      if (userOrganizationId) {
        organization = await db.selectOne<{
          id: string;
          is_configured: boolean | null;
        }>('organizations', {
          eq: { id: userOrganizationId },
        });

        // is_configured can be true, false, or null - ONLY true means configured
        // false or null means NOT configured
        organizationIsConfigured = organization?.is_configured === true;
        
        // Debug logging
        console.log('[AuthLayout] Organization check:', {
          userId: user.id,
          organizationId: userOrganizationId,
          organizationFound: !!organization,
          isConfiguredValue: organization?.is_configured,
          organizationIsConfigured
        });
      } else {
        console.log('[AuthLayout] User has no organization_id:', { userId: user.id });
      }

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

      // CRITICAL: Check organization configuration FIRST for ALL users (except Super Admins)
      // Super Admins are platform-level admins and don't need organization configuration
      // System Administrators (organization admins) MUST have configured organization
      
      // Check organization configuration for ALL users including System Administrators
      // Only Super Admins can bypass organization configuration check
      if (userIsSuperAdmin) {
        // Super admin (platform-level) - redirect away from organization-specific routes
        if (isOrgSpecificRoute && !isAdminPage && !isSubscriptionPage) {
          // Super admin trying to access org routes - always redirect to admin dashboard
          // Super admins manage the system from /admin/dashboard, not org-specific routes
          redirect('/admin/dashboard');
          return;
        }
        // Super admin accessing admin pages - allow access (no org check needed)
      } else {
        // ALL other users (including System Administrators): MUST have configured organization to access routes
        // CRITICAL: These checks MUST execute for all users - no exceptions
        // System Administrators can configure the organization from the /setup page
        if (!userOrganizationId) {
          // User without organization - MUST redirect to setup
          // No organization means user cannot access any protected routes
          // This applies to System Administrators too
          if (!isSetupPage) {
            console.log('[AuthLayout] User without organization - redirecting to /setup', { 
              pathname,
              isSystemAdmin,
              userId: user.id
            });
            redirect('/setup');
            return;
          }
          // User is on setup page - allow access
        } else {
          // User has organization - MUST check if configured
          // CRITICAL: is_configured must be explicitly true, false or null means NOT configured
          // This applies to ALL users including System Administrators
          if (organization?.is_configured !== true) {
            // Organization exists but is NOT configured (is_configured is false, null, or undefined)
            // Force redirect to setup for ALL routes except setup page itself
            // This applies to ALL users including System Administrators
            if (!isSetupPage) {
              console.log('[AuthLayout] Organization NOT configured - redirecting to /setup', {
                pathname,
                organizationId: userOrganizationId,
                isConfiguredValue: organization?.is_configured,
                isConfiguredType: typeof organization?.is_configured,
                isSystemAdmin,
                userId: user.id
              });
              redirect('/setup');
              return;
            }
            // User is on setup page - allow access to complete setup
          } else {
            console.log('[AuthLayout] Organization is configured - allowing access', {
              organizationId: userOrganizationId,
              pathname,
              isSystemAdmin,
              userId: user.id
            });
          }
        }

        
        // Organization is configured - continue with subscription checks
        // This applies to all users including System Administrators
        if (organizationIsConfigured && userOrganizationId) {
          // Check subscription status for users with configured organization
          const subscriptions = await db.select<{
            id: string;
            status: string;
          }>('subscriptions', {
            eq: { organization_id: userOrganizationId },
            limit: 1,
          });

          const subscription = subscriptions[0];
          const hasActiveSubscription = subscription && 
            (subscription.status === 'active' || subscription.status === 'trialing');

          // Check if user is organization admin (can edit Organization)
          const canEditOrg = await canUserAccessObject(user.id, 'Organization', 'edit');
          
          // If subscription is inactive, handle redirects
          if (!hasActiveSubscription && !isSubscriptionPage && !isSubscriptionInactivePage) {
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
        }
        
        // Organization is configured and subscription is active/trialing
        // Allow access to all routes (permissions checked in page components)
      }
    } catch (error) {
      // Don't catch NEXT_REDIRECT errors - let them bubble up
      // Only catch actual errors
      if (error && typeof error === 'object' && 'digest' in error) {
        const digest = (error as { digest?: string }).digest;
        if (digest && typeof digest === 'string' && digest.includes('NEXT_REDIRECT')) {
          // Re-throw NEXT_REDIRECT errors so Next.js can handle them
          throw error;
        }
      }
      console.error('Error checking organization:', error);
    }
  }

  return <AuthContent>{children}</AuthContent>;
}
