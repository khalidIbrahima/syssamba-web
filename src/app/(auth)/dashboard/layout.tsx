import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';

/**
 * Layout for dashboard - ensures organization is configured before showing dashboard
 * Note: Most checks are done in the parent (auth)/layout.tsx, but we add an extra
 * check here specifically for the dashboard route
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/sign-in');
  }

  // Check if organization is configured
  // This is a redundant check but ensures dashboard specifically requires organization
  try {
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (userIsSuperAdmin) {
      // Super-admin without organization should select one
      if (!user.organizationId) {
        redirect('/admin/select-organization');
      } else {
        // Super-admin with organization should go to /admin (their home page)
        redirect('/admin');
      }
    } else {
      // Regular user: must have organization
      if (!user.organizationId) {
        redirect('/setup');
      }
      // User has organization - allow access
    }
  } catch (error) {
    console.error('Error checking organization:', error);
    redirect('/setup');
  }

  return <>{children}</>;
}
