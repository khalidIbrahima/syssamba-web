'use client';

import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

/**
 * Standard page loading component
 * Used when checking permissions or loading data
 */
export function PageLoader({ message = 'Chargement...' }: PageLoaderProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

/**
 * Full screen page loader
 * Used for critical loading states
 */
export function PageLoaderFullScreen({ message = 'Chargement...' }: PageLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-lg font-medium text-gray-700">{message}</p>
      </div>
    </div>
  );
}

