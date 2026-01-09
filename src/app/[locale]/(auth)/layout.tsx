import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AuthContent } from '@/components/layout/auth-content';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { canUserAccessObject } from '@/lib/user-permissions';
import { db } from '@/lib/db';
import { routing } from '@/i18n/routing';

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
    try {
      const dbUser = await db.selectOne<{
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

      const userIsSuperAdmin = await isSuperAdmin(user.id);

      if (isSystemAdmin) {
        // System admin: check if organization is configured
        let organizationIsConfigured = false;
        
        if (user.organizationId) {
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
            redirect(`/${locale}/setup`);
            return;
          }
          // User is on /setup page - allow access to complete setup
        } else {
          // Organization is configured - allow access to all routes
          // No restrictions for System Admins with configured organizations
        }
      } else if (userIsSuperAdmin) {
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
        // Regular user: if no organization, redirect to setup
        if (!user.organizationId) {
          redirect(`/${locale}/setup`);
          return;
        }

        // Check if user is organization admin (can edit Organization)
        // Organization admins should have access to dashboard and other pages
        const canEditOrg = await canUserAccessObject(user.id, 'Organization', 'edit');
        
        if (canEditOrg) {
          // Organization admin - allow access to all pages including dashboard
          // No redirect needed
        } else {
          // Regular user with organization - allow access (permissions checked in page components)
          // User has organization - allow access to dashboard and other pages
        }
      }
    } catch (error) {
      console.error('Error checking organization:', error);
    }
  }

  return <AuthContent>{children}</AuthContent>;
}
