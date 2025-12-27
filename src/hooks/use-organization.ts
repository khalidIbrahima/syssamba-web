/**
 * Hook to get current user's organization ID
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';

async function getOrganizationId(): Promise<string | null> {
  try {
    const response = await fetch('/api/organization', {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.id || null;
  } catch (error) {
    console.error('Error fetching organization ID:', error);
    return null;
  }
}

export function useOrganization() {
  const { isSignedIn } = useAuth();
  
  const { data: organizationId, isLoading } = useQuery({
    queryKey: ['organization-id'],
    queryFn: getOrganizationId,
    enabled: isSignedIn ?? false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    organizationId: organizationId || null,
    isLoading,
  };
}

