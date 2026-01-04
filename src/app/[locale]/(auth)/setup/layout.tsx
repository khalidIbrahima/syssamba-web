import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

/**
 * Layout for setup page - no sidebar/header, just the setup form
 * The parent (auth)/layout.tsx already ensures only users without organizations can access this page
 * No additional redirect logic needed here
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

  // The auth layout already handles all organization-based redirects
  // Only users without organizations can reach this page

  return <>{children}</>;
}
