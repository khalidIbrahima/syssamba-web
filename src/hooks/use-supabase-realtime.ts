/**
 * React hooks for Supabase Realtime subscriptions
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './use-auth';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook to subscribe to real-time updates for a specific table using Supabase Realtime
 */
export function useSupabaseRealtime<T = any>(
  table: string,
  options?: {
    organizationId?: string;
    userId?: string;
    tenantId?: string;
    onUpdate?: (payload: any) => void;
    queryKey?: string[];
    enabled?: boolean;
    filter?: string; // PostgreSQL filter, e.g., "organization_id=eq.123"
  }
) {
  const queryClient = useQueryClient();
  const { userId: authUserId } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const {
    organizationId,
    userId: userIdParam,
    tenantId,
    onUpdate,
    queryKey,
    enabled = true,
    filter,
  } = options || {};
  
  // Use provided userId or fallback to authenticated user's ID
  const userId = userIdParam || authUserId;

  useEffect(() => {
    if (!enabled || !supabase) return;

    let mounted = true;
    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      try {
        // Use Supabase client directly (auth handled via cookies)
        const client = supabase;

        if (!client) {
          console.warn('Supabase client not available');
          return;
        }

        // Build filter string
        let filterString = '';
        if (filter) {
          filterString = filter;
        } else if (organizationId) {
          filterString = `organization_id=eq.${organizationId}`;
        } else if (tenantId) {
          filterString = `tenant_id=eq.${tenantId}`;
        } else if (userId) {
          filterString = `assigned_to=eq.${userId}`;
        }

        // Create channel name
        const channelName = filterString
          ? `${table}:${filterString}`
          : table;

        // Subscribe to changes
        channel = client
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: table,
              filter: filterString || undefined,
            },
            (payload) => {
              if (!mounted) return;

              // Call custom callback if provided
              onUpdate?.(payload);

              // Invalidate React Query cache
              if (queryKey) {
                queryClient.invalidateQueries({ queryKey });
              } else {
                // Default: invalidate all queries for this table
                queryClient.invalidateQueries({ queryKey: [table] });
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log(`✓ Subscribed to ${table} real-time updates`);
            } else if (status === 'CHANNEL_ERROR') {
              console.error(`Error subscribing to ${table}`);
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error(`Error setting up Supabase real-time subscription for ${table}:`, error);
      }
    };

    setupSubscription();

    return () => {
      mounted = false;
      if (channel) {
        channel.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [
    table,
    organizationId,
    userId,
    tenantId,
    enabled,
    queryClient,
    userId,
    onUpdate,
    queryKey,
    filter,
  ]);
}

/**
 * Hook for real-time task updates using Supabase
 */
export function useSupabaseRealtimeTasks(organizationId?: string, userIdParam?: string) {
  const queryClient = useQueryClient();
  const { userId: authUserId } = useAuth();
  const userId = userIdParam || authUserId;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!organizationId || !supabase) {
      console.warn('useSupabaseRealtimeTasks: organizationId or supabase not available');
      return;
    }

    let mounted = true;
    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      try {
        // Use the anonymous Supabase client for Realtime
        // Since RLS is disabled and we filter by organization_id client-side,
        // we don't need authenticated client for Realtime subscriptions
        const client = supabase;

        if (!client) {
          console.warn('useSupabaseRealtimeTasks: Supabase client not available');
          return;
        }

        // Filter by organization_id to get all tasks for the organization
        // This ensures we see all tasks, not just those assigned to the current user
        const filter = `organization_id=eq.${organizationId}`;

        console.log(`[Realtime] Setting up subscription for tasks`);
        console.log(`[Realtime] Organization ID: ${organizationId}`);
        console.log(`[Realtime] Filter: ${filter}`);
        console.log(`[Realtime] Client URL: ${client.supabaseUrl}`);

        channel = client
          .channel(`tasks:${organizationId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'tasks',
              filter: filter,
            },
            (payload) => {
              if (!mounted) return;

              console.log('Real-time task update received:', {
                eventType: payload.eventType,
                taskId: payload.new?.id || payload.old?.id,
                newStatus: payload.new?.status,
                oldStatus: payload.old?.status,
                payload: payload,
              });

              // For UPDATE events, optimistically update the cache if we have the new data
              if (payload.eventType === 'UPDATE' && payload.new) {
                const updatedTask = payload.new;
                console.log('[Realtime] UPDATE event received:', {
                  taskId: updatedTask.id,
                  newStatus: updatedTask.status,
                  oldStatus: payload.old?.status,
                });
                
                queryClient.setQueryData(['tasks'], (old: any) => {
                  if (!old) {
                    console.warn('[Realtime] No existing tasks in cache to update');
                    return old;
                  }
                  
                  const taskIndex = old.findIndex((t: any) => t.id === updatedTask.id);
                  if (taskIndex === -1) {
                    console.warn('[Realtime] Task not found in cache:', updatedTask.id);
                    return old;
                  }
                  
                  // Map snake_case from Supabase to camelCase for the app
                  // Preserve all existing properties and only update changed ones
                  const existingTask = old[taskIndex];
                  const mappedTask = {
                    ...existingTask, // Preserve all existing properties (createdBy, createdByName, etc.)
                    status: updatedTask.status !== undefined ? updatedTask.status : existingTask.status,
                    title: updatedTask.title !== undefined ? updatedTask.title : existingTask.title,
                    description: updatedTask.description !== undefined ? updatedTask.description : existingTask.description,
                    priority: updatedTask.priority !== undefined ? updatedTask.priority : existingTask.priority,
                    assignedTo: updatedTask.assigned_to !== undefined ? updatedTask.assigned_to : existingTask.assignedTo,
                    assignedTenantId: updatedTask.assigned_tenant_id !== undefined ? updatedTask.assigned_tenant_id : existingTask.assignedTenantId,
                    dueDate: updatedTask.due_date !== undefined ? updatedTask.due_date : existingTask.dueDate,
                    attachments: updatedTask.attachments !== undefined ? updatedTask.attachments : existingTask.attachments,
                    updatedAt: updatedTask.updated_at || new Date().toISOString(),
                  };
                  
                  console.log('[Realtime] Task updated in cache:', {
                    id: mappedTask.id,
                    status: mappedTask.status,
                    title: mappedTask.title,
                  });
                  
                  // Create new array to trigger React re-render
                  const updated = [...old];
                  updated[taskIndex] = mappedTask;
                  
                  console.log('[Realtime] Cache updated, tasks count:', updated.length);
                  return updated;
                });
                
                // Force a refetch after a short delay to ensure consistency
                // This ensures the UI updates even if the optimistic update doesn't trigger a re-render
                setTimeout(() => {
                  console.log('[Realtime] Invalidating tasks cache to ensure UI update');
                  queryClient.invalidateQueries({ queryKey: ['tasks'] });
                }, 100);
              } else {
                // For INSERT or DELETE, invalidate to refetch
                console.log('Invalidating tasks cache for', payload.eventType);
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
              }
              
              // Also invalidate specific task if we have the ID
              const taskId = payload.new?.id || payload.old?.id;
              if (taskId) {
                queryClient.invalidateQueries({ queryKey: ['task', taskId] });
              }
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log(`✓ Subscribed to real-time task updates for organization ${organizationId}`);
            } else if (status === 'CHANNEL_ERROR') {
              console.error(`✗ Error subscribing to real-time task updates for organization ${organizationId}:`, err);
            } else if (status === 'TIMED_OUT') {
              console.error(`✗ Timeout subscribing to real-time task updates for organization ${organizationId}`);
            } else if (status === 'CLOSED') {
              console.warn(`⚠️ Real-time channel closed for organization ${organizationId}`);
            } else {
              console.log(`Real-time subscription status: ${status}`, err ? `Error: ${err}` : '');
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('Error setting up Supabase real-time tasks:', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (channel) {
        console.log('Unsubscribing from real-time task updates');
        channel.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [organizationId, queryClient, userId]);
}

/**
 * Hook for real-time message updates using Supabase
 */
export function useSupabaseRealtimeMessages(organizationId?: string, tenantId?: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if ((!organizationId && !tenantId) || !supabase) return;

    let mounted = true;
    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      try {
        const client = supabase;

        if (!client) return;

        const filter = tenantId
          ? `tenant_id=eq.${tenantId}`
          : organizationId
          ? `organization_id=eq.${organizationId}`
          : undefined;

        channel = client
          .channel(`messages:${filter || 'all'}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: filter,
            },
            (payload) => {
              if (!mounted) return;

              // Invalidate messages queries
              queryClient.invalidateQueries({ queryKey: ['messages'] });
              if (tenantId) {
                queryClient.invalidateQueries({ queryKey: ['messages', tenantId] });
              }
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (error) {
        console.error('Error setting up Supabase real-time messages:', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (channel) {
        channel.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [organizationId, tenantId, queryClient, userId]);
}

/**
 * Hook for real-time payment updates using Supabase
 */
export function useSupabaseRealtimePayments(organizationId?: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!organizationId || !supabase) return;

    let mounted = true;
    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      try {
        const client = supabase;

        if (!client) return;

        channel = client
          .channel(`payments:${organizationId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'payments',
              filter: `organization_id=eq.${organizationId}`,
            },
            (payload) => {
              if (!mounted) return;

              // Invalidate payment queries
              queryClient.invalidateQueries({ queryKey: ['payments'] });
              queryClient.invalidateQueries({ queryKey: ['payments', 'owner-transfers'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (error) {
        console.error('Error setting up Supabase real-time payments:', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (channel) {
        channel.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [organizationId, queryClient, userId]);
}

