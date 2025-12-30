import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AuthContent } from '@/components/layout/auth-content';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
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
        redirect('/auth/sign-in');
        return;
      }

      const userIsSuperAdmin = await isSuperAdmin(user.id);

      if (userIsSuperAdmin) {
        // Super admin: always allow access to admin pages
        // If not on admin page, redirect to /admin
        if (!isAdminPage) {
          redirect('/admin');
        }
        // If already on admin pages, allow access
      } else {
        // Regular user: if no organization, redirect to setup
        // If user has organization, allow access (don't redirect to setup)
        if (!user.organizationId) {
          redirect('/setup');
          return;
        }
        // User has organization - allow access to dashboard and other pages
      }
    } catch (error) {
      console.error('Error checking organization:', error);
    }
  }

  return <AuthContent>{children}</AuthContent>;
}
