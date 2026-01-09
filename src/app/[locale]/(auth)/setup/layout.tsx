import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Layout for setup page - no sidebar/header, just the setup form
 * CRITICAL: This page should ONLY be accessible when organization is NOT configured
 * If organization is already configured, redirect to dashboard
 */
export default async function SetupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/auth/sign-in`);
  }

  // CRITICAL CHECK: If organization is already configured, redirect away from setup
  if (user.organizationId) {
    const organization = await db.selectOne<{
      id: string;
      is_configured: boolean;
    }>('organizations', {
      eq: { id: user.organizationId },
    });

    // If organization is configured, redirect to dashboard
    if (organization?.is_configured === true) {
      redirect(`/${locale}/dashboard`);
      return;
    }
  }

  // Organization is not configured (or user has no org) - allow access to setup
  return <>{children}</>;
}
