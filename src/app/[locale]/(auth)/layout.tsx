import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AuthContent } from '@/components/layout/auth-content';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { canUserAccessObject } from '@/lib/user-permissions';
import { db } from '@/lib/db';
import { routing } from '@/i18n/routing';

// Force dynamic rendering for authenticated routes (uses cookies/headers)
export const dynamic = 'force-dynamic';

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // Ensure locale is valid
  if (!routing.locales.includes(locale as any)) {
    redirect('/');
  }

  const user = await getCurrentUser();
  
  if (!user) {
    redirect(`/${locale}/auth/sign-in`);
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
    const userIsSuperAdmin = await isSuperAdmin(user.id);
    if (userIsSuperAdmin) {
      // Super admin should NEVER access setup page - redirect to admin
      redirect(`/${locale}/admin/select-organization`);
      return;
    }

    // Check if organization is already configured and redirect away
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
          redirect(`/${locale}/dashboard`);
          return;
        }
      }
    } catch (error) {
      console.error('Error checking organization configuration for setup page:', error);
    }
  }

  // Check organization configuration
  // Allow access to auth pages and setup page without organization checks (setup is checked above)
  if (!isAuthPage && !isSetupPage && !isAdminSelectPage) {
    // Fetch user data - do this outside redirect logic to avoid catching NEXT_REDIRECT
    let dbUser;
    let dbUserWithProfile;
    let isSystemAdmin = false;
    let userIsSuperAdmin = false;
    let organization = null;
    let subscriptions = [];
    
    try {
      dbUser = await db.selectOne<{
        id: string;
        organization_id: string | null;
      }>('users', {
        eq: { id: user.id },
      });

      if (!dbUser) {
        redirect(`/${locale}/auth/sign-in`);
        return;
      }

      // Check if user has System Administrator profile (system admin)
      dbUserWithProfile = await db.selectOne<{
        id: string;
        profile_id: string | null;
        organization_id: string | null;
      }>('users', {
        eq: { id: user.id },
      });

      // Get profile name to check if user is System Administrator
      if (dbUserWithProfile?.profile_id) {
        const profile = await db.selectOne<{
          id: string;
          name: string;
        }>('profiles', {
          eq: { id: dbUserWithProfile.profile_id },
        });
        isSystemAdmin = profile?.name === 'System Administrator';
      }

      userIsSuperAdmin = await isSuperAdmin(user.id);
    } catch (error) {
      console.error('Error fetching user data:', error);
      // If we can't fetch user data, redirect to sign-in
      redirect(`/${locale}/auth/sign-in`);
      return;
    }

    // Check organization configuration for ALL users including System Administrators
    // CRITICAL: System Administrators must also have configured organization to access routes
    if (userIsSuperAdmin) {
      // Super admin: redirect dashboard to /admin (their home page)
      if (isDashboardPage) {
        if (!user.organizationId) {
          redirect(`/${locale}/admin/select-organization`);
          return;
        } else {
          redirect(`/${locale}/admin`);
          return;
        }
      }
      // Super admin without organization trying to access non-admin pages
      if (!isAdminPage && !user.organizationId) {
        redirect(`/${locale}/admin/select-organization`);
        return;
      }
      // If on admin pages or has organization, allow access to all pages
    } else {
      // ALL users (including System Administrators): MUST have configured organization to access routes
      // CRITICAL: Use dbUser.organization_id for accurate check (not user.organizationId which might be stale)
      const userOrganizationId = dbUser?.organization_id;
      
      if (!userOrganizationId) {
        // User without organization - MUST redirect to setup
        // No organization means user cannot access any protected routes
        // This applies to ALL users including System Administrators
        if (!isSetupPage) {
          console.log('[AuthLayout] User without organization - redirecting to setup', { 
            locale, 
            pathname,
            isSystemAdmin,
            userId: user.id
          });
          redirect(`/${locale}/setup`);
          return;
        }
        // User is on setup page - allow access
      } else {
        // Fetch organization data
        try {
          organization = await db.selectOne<{
            id: string;
            is_configured: boolean | null;
          }>('organizations', {
            eq: { id: userOrganizationId },
          });
        } catch (error) {
          console.error('Error fetching organization:', error);
          // If we can't fetch organization, treat as not configured
          if (!isSetupPage) {
            redirect(`/${locale}/setup`);
            return;
          }
        }

        // CRITICAL: is_configured must be explicitly true
        // false, null, or undefined means NOT configured
        // This applies to ALL users including System Administrators
        if (organization?.is_configured !== true) {
          // Organization exists but is NOT configured - redirect to setup
          // Only allow access to setup page itself
          if (!isSetupPage) {
            console.log('[AuthLayout] Organization NOT configured - redirecting to setup', {
              locale,
              pathname,
              organizationId: userOrganizationId,
              isConfiguredValue: organization?.is_configured,
              isConfiguredType: typeof organization?.is_configured,
              isSystemAdmin,
              userId: user.id
            });
            redirect(`/${locale}/setup`);
            return;
          }
          // User is on setup page - allow access to complete setup
        } else {
          console.log('[AuthLayout] Organization is configured - allowing access', {
            locale,
            organizationId: userOrganizationId,
            pathname,
            isSystemAdmin,
            userId: user.id
          });

          // Organization is configured - check subscription and permissions
          try {
            subscriptions = await db.select<{
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
                redirect(`/${locale}/settings/subscription`);
                return;
              } else {
                // Non-admin user: redirect to inactive subscription page
                redirect(`/${locale}/subscription-inactive`);
                return;
              }
            }
          } catch (error) {
            console.error('Error checking subscription:', error);
            // If subscription check fails, allow access (graceful degradation)
          }

          // Organization is configured and subscription is active/trialing
          // Allow access to all routes (permissions checked in page components)
        }
      }
    }
  }

  return <AuthContent>{children}</AuthContent>;
}
