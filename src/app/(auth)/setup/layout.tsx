import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';

/**
 * Layout for setup page - no sidebar/header, just the setup form
 * CRITICAL: This page should ONLY be accessible to super admins
 * Super admins can set up organizations for new users or manage existing organizations
 */
export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // CRITICAL CHECK: Only super admins can access the setup page
  const userIsSuperAdmin = await isSuperAdmin(user.id);
  if (!userIsSuperAdmin) {
    redirect('/dashboard');
    return;
  }

  // CRITICAL CHECK: If organization is already configured, redirect away from setup
  // (This is now less relevant since only super admins can access, but keeping for safety)
  if (user.organizationId) {
    const organization = await db.selectOne<{
      id: string;
      is_configured: boolean;
    }>('organizations', {
      eq: { id: user.organizationId },
    });

    // If organization is configured, redirect to dashboard
    if (organization?.is_configured === true) {
      redirect('/dashboard');
      return;
    }
  }

  // User is super admin - allow access to setup
  return <>{children}</>;
}
