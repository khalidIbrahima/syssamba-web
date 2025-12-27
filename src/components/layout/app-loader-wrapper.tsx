'use client';

import { Component, ReactNode } from 'react';
import { AppLoader } from './app-loader';

/**
 * Error boundary wrapper for AppLoader
 * Catches errors if QueryClientProvider is not available
 */
class AppLoaderErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // If it's a QueryClient error, just show loading
    if (error.message.includes('QueryClient')) {
      console.warn('QueryClient not available yet, showing loading screen');
    } else {
      console.error('AppLoader error:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      // Show loading screen if there's an error (likely QueryClient not available)
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-lg font-medium text-gray-700">Loading settings...</p>
            <p className="text-sm text-gray-500">Please wait while we load your data</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper component that provides error boundary for AppLoader
 */
export function AppLoaderWrapper({ children }: { children: ReactNode }) {
  return (
    <AppLoaderErrorBoundary>
      <AppLoader>{children}</AppLoader>
    </AppLoaderErrorBoundary>
  );
}

