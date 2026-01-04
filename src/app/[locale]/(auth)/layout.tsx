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

  // Check if super admin is trying to access setup page - NEVER allow this
  if (isSetupPage) {
    const userIsSuperAdmin = await isSuperAdmin(user.id);
      if (userIsSuperAdmin) {
        // Super admin should NEVER access setup page - redirect to admin
        redirect(`/${locale}/admin/select-organization`);
        return;
      }
  }

  // Check organization configuration
  if (!isSetupPage && !isAdminSelectPage) {
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

      const userIsSuperAdmin = await isSuperAdmin(user.id);

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
