/**
 * React hooks for real-time subscriptions
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeClient, type RealtimeEvent } from '@/lib/realtime-client';
import { useAuth } from './use-auth';
import { supabase } from '@/lib/supabase';

/**
 * Hook to subscribe to real-time updates for a specific table
 */
export function useRealtime<T = any>(
  table: string,
  options?: {
    organizationId?: string;
    userId?: string;
    tenantId?: string;
    onUpdate?: (event: RealtimeEvent) => void;
    queryKey?: string[];
    enabled?: boolean;
  }
) {
  const queryClient = useQueryClient();
  const { userId: authUserId } = useAuth();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const client = getRealtimeClient();

  const {
    organizationId,
    userId,
    tenantId,
    onUpdate,
    queryKey,
    enabled = true,
  } = options || {};

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      try {
        // Check if real-time is disabled
        if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_REALTIME_DISABLED === 'true') {
          return; // Silently skip if disabled
        }

        // Get auth token from Supabase
        const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;

        // Connect if not connected (with timeout)
        if (!client.connected) {
          const connectPromise = client.connect(token || undefined);
          
          // Wait for connection with timeout (don't block if server is unavailable)
          await Promise.race([
            connectPromise,
            new Promise<void>((resolve) => {
              setTimeout(() => resolve(), 2000); // 2 second timeout
            }),
          ]);
        }

        // Quick check if connected, don't wait long
        if (!client.connected) {
          // Server not available, skip subscription silently
          return;
        }

        if (!mounted) return;

        // Setup callback
        const callback = (event: RealtimeEvent) => {
          if (!mounted) return;

          // Call custom callback if provided
          onUpdate?.(event);

          // Invalidate React Query cache
          if (queryKey) {
            queryClient.invalidateQueries({ queryKey });
          } else {
            // Default: invalidate all queries for this table
            queryClient.invalidateQueries({ queryKey: [table] });
          }
        };

        // Subscribe based on options
        if (tenantId) {
          unsubscribe = client.subscribeToTenant(tenantId, table, callback);
        } else if (userId) {
          unsubscribe = client.subscribeToUser(userId, table, callback);
        } else if (organizationId) {
          unsubscribe = client.subscribeToOrganization(
            organizationId,
            table,
            callback
          );
        } else {
          unsubscribe = client.subscribe(table, callback);
        }
        unsubscribeRef.current = unsubscribe;
      } catch (error) {
        // Silently fail if real-time is not available
        console.debug(`Real-time subscription for ${table} not available (server may be offline)`);
      }
    };

    setupSubscription();

    return () => {
      mounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [
    table,
    organizationId,
    userId,
    tenantId,
    enabled,
    queryClient,
    onUpdate,
    queryKey,
  ]);
}

/**
 * Hook for real-time task updates
 */
export function useRealtimeTasks(organizationId?: string, userId?: string) {
  const queryClient = useQueryClient();
  const { userId: authUserId } = useAuth();
  const client = getRealtimeClient();

  useEffect(() => {
    if (!organizationId && !userId) return;

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const token = await getToken();
        if (!client.connected) {
          await client.connect(token || undefined);
        }

        await new Promise<void>((resolve) => {
          if (client.connected) {
            resolve();
          } else {
            const checkConnection = setInterval(() => {
              if (client.connected) {
                clearInterval(checkConnection);
                resolve();
              }
            }, 100);
          }
        });

        if (!mounted) return;

        const callback = (event: RealtimeEvent) => {
          if (!mounted) return;

          // Invalidate tasks queries
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['task', event.id] });
        };

        if (userId) {
          unsubscribe = client.subscribeToUser(userId, 'tasks', callback);
        } else if (organizationId) {
          unsubscribe = client.subscribeToOrganization(organizationId, 'tasks', callback);
        }
      } catch (error) {
        console.error('Error setting up real-time tasks:', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [organizationId, userId, queryClient, getToken]);
}

/**
 * Hook for real-time message updates
 */
export function useRealtimeMessages(organizationId?: string, tenantId?: string) {
  const queryClient = useQueryClient();
  const { userId: authUserId } = useAuth();
  const client = getRealtimeClient();

  useEffect(() => {
    if (!organizationId && !tenantId) return;

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const token = await getToken();
        if (!client.connected) {
          await client.connect(token || undefined);
        }

        await new Promise<void>((resolve) => {
          if (client.connected) {
            resolve();
          } else {
            const checkConnection = setInterval(() => {
              if (client.connected) {
                clearInterval(checkConnection);
                resolve();
              }
            }, 100);
          }
        });

        if (!mounted) return;

        const callback = (event: RealtimeEvent) => {
          if (!mounted) return;

          // Invalidate messages queries
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          if (tenantId) {
            queryClient.invalidateQueries({ queryKey: ['messages', tenantId] });
          }
        };

        if (tenantId) {
          unsubscribe = client.subscribeToTenant(tenantId, 'messages', callback);
        } else if (organizationId) {
          unsubscribe = client.subscribeToOrganization(organizationId, 'messages', callback);
        }
      } catch (error) {
        console.error('Error setting up real-time messages:', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [organizationId, tenantId, queryClient, getToken]);
}

/**
 * Hook for real-time payment updates
 */
export function useRealtimePayments(organizationId?: string) {
  const queryClient = useQueryClient();
  const { userId: authUserId } = useAuth();
  const client = getRealtimeClient();

  useEffect(() => {
    if (!organizationId) return;

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const token = await getToken();
        if (!client.connected) {
          await client.connect(token || undefined);
        }

        await new Promise<void>((resolve) => {
          if (client.connected) {
            resolve();
          } else {
            const checkConnection = setInterval(() => {
              if (client.connected) {
                clearInterval(checkConnection);
                resolve();
              }
            }, 100);
          }
        });

        if (!mounted) return;

        const callback = (event: RealtimeEvent) => {
          if (!mounted) return;

          // Invalidate payment queries
          queryClient.invalidateQueries({ queryKey: ['payments'] });
          queryClient.invalidateQueries({ queryKey: ['payments', 'owner-transfers'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        };

        unsubscribe = client.subscribeToOrganization(organizationId, 'payments', callback);
      } catch (error) {
        console.error('Error setting up real-time payments:', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [organizationId, queryClient, getToken]);
}

