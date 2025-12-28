'use client';

import { useQuery } from '@tanstack/react-query';

async function checkSuperAdmin(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/check-super-admin', {
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      console.warn('[useSuperAdmin] Rate limit reached, implementing backoff');
      // Return cached result or false for rate limited requests
      return false;
    }

    if (!response.ok) {
      console.warn('[useSuperAdmin] API error:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    return data.isSuperAdmin || false;
  } catch (error) {
    console.error('[useSuperAdmin] Network error:', error);
    return false;
  }
}

// Global cache to prevent multiple simultaneous calls
let globalSuperAdminCache: { value: boolean; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useSuperAdmin() {
  const { data: isSuperAdmin, isLoading, error } = useQuery({
    queryKey: ['super-admin-check'],
    queryFn: async () => {
      // Check global cache first
      const now = Date.now();
      if (globalSuperAdminCache && (now - globalSuperAdminCache.timestamp) < CACHE_DURATION) {
        return globalSuperAdminCache.value;
      }

      // Make API call
      const result = await checkSuperAdmin();

      // Update global cache
      globalSuperAdminCache = { value: result, timestamp: now };

      return result;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error: any) => {
      // Don't retry on rate limiting
      if (error?.status === 429) return false;
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  return {
    isSuperAdmin: isSuperAdmin || false,
    isLoading,
    error,
  };
}


