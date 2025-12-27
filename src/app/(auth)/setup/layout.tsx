import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';

/**
 * Layout for setup page - no sidebar/header, just the setup form
 * This layout ensures that if organization is already configured, redirect to dashboard
 * Super-admin redirects are handled by the parent (auth)/layout.tsx
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

  try {
    // Super admin redirects are handled by the parent (auth)/layout.tsx
    // This layout only handles regular users

    // If user has an organization, redirect to dashboard (don't show setup)
    if (user.organizationId) {
      redirect('/dashboard');
    }
  } catch (error) {
    console.error('Error checking organization:', error);
  }

  return <>{children}</>;
}
