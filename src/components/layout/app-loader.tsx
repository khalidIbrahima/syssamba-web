'use client';

import { useEffect, useState } from 'react';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { useOrganization } from '@/hooks/use-organization';
import { Loader2 } from 'lucide-react';

/**
 * Global app loader component
 * Shows a loading screen while critical data is being fetched
 * This ensures all necessary data (plan, access, organization, etc.) is loaded before rendering the app
 * 
 * Note: This component must be rendered within QueryClientProvider (which is in RootLayout)
 */
export function AppLoader({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  
  // Ensure component is mounted on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use hooks - they require QueryClientProvider to be in the component tree
  // Since QueryProvider is in RootLayout, it should be available
  const { isLoading: isPlanLoading } = usePlan();
  const { isLoading: isAccessLoading } = useAccess();
  const { isLoading: isOrganizationLoading } = useOrganization();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Track if this is the initial load
  useEffect(() => {
    if (isMounted && !isPlanLoading && !isAccessLoading && !isOrganizationLoading) {
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isMounted, isPlanLoading, isAccessLoading, isOrganizationLoading]);

  // Show loading screen while data is being fetched or component is not mounted
  // Use suppressHydrationWarning to ignore differences caused by browser extensions (e.g., Dark Reader)
  const isLoading = !isMounted || isInitialLoad || isPlanLoading || isAccessLoading || isOrganizationLoading;
  
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white" suppressHydrationWarning>
        <div className="flex flex-col items-center gap-4" suppressHydrationWarning>
          {isMounted ? (
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" suppressHydrationWarning />
          ) : (
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" suppressHydrationWarning />
          )}
          <p className="text-lg font-medium text-gray-700" suppressHydrationWarning>Loading settings...</p>
          <p className="text-sm text-gray-500" suppressHydrationWarning>Please wait while we load your data</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

