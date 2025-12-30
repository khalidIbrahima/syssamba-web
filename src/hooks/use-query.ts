import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Generic hook for fetching data
export function useDataQuery<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number; // React Query v5: renamed from cacheTime
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: key,
    queryFn,
    staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutes default
    gcTime: options?.gcTime, // Garbage collection time
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled !== false,
  });
}

// Generic hook for mutations
export function useDataMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    invalidateQueries?: string[][];
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      options?.onSuccess?.(data);

      // Invalidate related queries
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
      }
    },
    onError: options?.onError,
  });
}