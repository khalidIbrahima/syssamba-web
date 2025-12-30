'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AppLoaderWrapper } from '@/components/layout/app-loader-wrapper';
import { FeatureProvider } from '@/contexts/FeatureContext';
import { ProfilePermissionsProvider } from '@/contexts/ProfilePermissionsContext';

/**
 * Client-side wrapper for authenticated content
 * This component handles the loading state and renders the app layout
 */
export function AuthContent({ children }: { children: React.ReactNode }) {
  return (
    <AppLoaderWrapper>
      <FeatureProvider>
        <ProfilePermissionsProvider>
          <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <div className="lg:pl-64">
              <Header />
              <main className="py-6 px-4 sm:px-6 lg:px-8 bg-gray-50">
                {children}
              </main>
            </div>
          </div>
        </ProfilePermissionsProvider>
      </FeatureProvider>
    </AppLoaderWrapper>
  );
}

