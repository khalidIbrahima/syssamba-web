'use client';

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './use-auth';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PaymentNotification {
  id: string;
  paymentId: string;
  tenantName: string | null;
  amount: number;
  status: string;
}

/**
 * Hook for real-time payment notifications
 * Shows toast notifications when new payments are created
 */
export function usePaymentNotifications(
  organizationId?: string,
  onNotificationClick?: (notification: PaymentNotification) => void
) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Fetch current user's database ID once
  useEffect(() => {
    if (!userId || currentUserIdRef.current) return;

    const fetchCurrentUserId = async () => {
      if (!supabase) return;

      try {
        const { data: currentUserRecord } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (currentUserRecord) {
          currentUserIdRef.current = currentUserRecord.id;
        }
      } catch (error) {
        console.error('Error fetching current user ID:', error);
      }
    };

    fetchCurrentUserId();
  }, [userId]);

  // Fetch initial unread count and set up polling to refresh it
  useEffect(() => {
    // Check if real-time is disabled via environment variable FIRST
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_REALTIME_DISABLED === 'true') {
      console.log('[usePaymentNotifications] Real-time disabled - skipping unread count polling');
      setUnreadCount(0); // Reset to 0 when disabled
      return;
    }

    if (!organizationId) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/notifications/unread-count', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    // Fetch immediately
    fetchUnreadCount();

    // Set up polling to refresh unread count every 10 seconds
    const interval = setInterval(fetchUnreadCount, 10000);

    return () => clearInterval(interval);
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !supabase) return;

    // Check if real-time is disabled via environment variable
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_REALTIME_DISABLED === 'true') {
      console.log('[usePaymentNotifications] Real-time disabled via NEXT_PUBLIC_REALTIME_DISABLED');
      return;
    }

    let mounted = true;
    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      try {
        // Use the anonymous Supabase client for Realtime
        const client = supabase;

        if (!client) {
          console.warn('usePaymentNotifications: Supabase client not available');
          return;
        }

        // Subscribe to payment inserts in the organization
        channel = client
          .channel(`payments:org:${organizationId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'payments',
              filter: `organization_id=eq.${organizationId}`,
            },
            async (payload) => {
              if (!mounted) return;

              const newPayment = payload.new as {
                id: string;
                organization_id: string;
                tenant_id: string | null;
                amount: string | number;
                status: string;
                created_at: string;
              };

              console.log('[Payment Notifications] New payment received:', newPayment);

              // Get tenant name
              let tenantName = 'Un locataire';
              if (newPayment.tenant_id) {
                try {
                  const { data: tenant, error: tenantError } = await client
                    .from('tenants')
                    .select('first_name, last_name')
                    .eq('id', newPayment.tenant_id)
                    .maybeSingle();

                  if (!tenantError && tenant) {
                    const firstName = tenant.first_name || '';
                    const lastName = tenant.last_name || '';
                    tenantName = `${firstName} ${lastName}`.trim();
                    if (!tenantName) {
                      tenantName = 'Un locataire';
                    }
                  }
                } catch (error) {
                  console.error('Error fetching tenant name:', error);
                }
              }

              // Format amount
              const amount = typeof newPayment.amount === 'string' 
                ? parseFloat(newPayment.amount) 
                : newPayment.amount;
              const formattedAmount = new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'XOF',
              }).format(amount);

              // Create notification in database for all users in the organization
              // Use current user ID if available, otherwise fetch it
              let currentUserIdInDb = currentUserIdRef.current;
              if (!currentUserIdInDb && userId) {
                try {
                  const { data: currentUserRecord } = await client
                    .from('users')
                    .select('id')
                    .eq('sb_user_id', userId)
                    .maybeSingle();

                  if (currentUserRecord) {
                    currentUserIdInDb = currentUserRecord.id;
                    currentUserIdRef.current = currentUserRecord.id;
                  }
                } catch (error) {
                  console.error('Error fetching current user ID:', error);
                }
              }

              // Notifications are automatically created by database trigger
              // No need to call API here - the trigger handles it
              console.log('[Payment Notifications] Payment detected, notifications will be created by trigger');

              // Show toast notification
              const paymentNotification: PaymentNotification = {
                id: newPayment.id,
                paymentId: newPayment.id,
                tenantName,
                amount,
                status: newPayment.status,
              };

              toast.info(
                `Nouveau paiement: ${formattedAmount} de ${tenantName}`,
                {
                  duration: 5000,
                  action: {
                    label: 'Voir',
                    onClick: () => {
                      onNotificationClick?.(paymentNotification);
                    },
                  },
                }
              );

              // Refresh unread count after a short delay to allow the trigger to complete
              setTimeout(async () => {
                try {
                  const response = await fetch('/api/notifications/unread-count', {
                    credentials: 'include',
                  });
                  if (response.ok) {
                    const data = await response.json();
                    setUnreadCount(data.unreadCount || 0);
                  }
                } catch (error) {
                  console.error('Error refreshing unread count:', error);
                }
              }, 500);

              // Invalidate notifications queries
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
              queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `organization_id=eq.${organizationId}`,
            },
            async (payload) => {
              if (!mounted) return;

              const newNotification = payload.new as {
                id: string;
                user_id: string;
                payment_id: string | null;
                type: string;
                read_at: string | null;
              };

              // Use cached current user ID or fetch it if not available
              let currentUserIdInDb = currentUserIdRef.current;
              if (!currentUserIdInDb && userId) {
                try {
                  const { data: currentUserRecord } = await client
                    .from('users')
                    .select('id')
                    .eq('sb_user_id', userId)
                    .maybeSingle();

                  if (currentUserRecord) {
                    currentUserIdInDb = currentUserRecord.id;
                    currentUserIdRef.current = currentUserRecord.id;
                  }
                } catch (error) {
                  console.error('Error fetching current user ID:', error);
                }
              }

              // Only update count if this notification is for the current user and is unread
              if (newNotification.user_id === currentUserIdInDb && !newNotification.read_at) {
                if (newNotification.type === 'payment_created' && newNotification.payment_id) {
                  // Increment unread count
                  setUnreadCount((prev) => prev + 1);
                }
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `organization_id=eq.${organizationId}`,
            },
            async (payload) => {
              if (!mounted) return;

              const updatedNotification = payload.new as {
                id: string;
                user_id: string;
                read_at: string | null;
              };

              const oldNotification = payload.old as {
                read_at: string | null;
              };

              // If a notification was just marked as read (read_at changed from null to a timestamp)
              if (!oldNotification.read_at && updatedNotification.read_at) {
                // Use cached current user ID or fetch it if not available
                let currentUserIdInDb = currentUserIdRef.current;
                if (!currentUserIdInDb && userId) {
                  try {
                    const { data: currentUserRecord } = await client
                      .from('users')
                      .select('id')
                      .eq('sb_user_id', userId)
                      .maybeSingle();

                    if (currentUserRecord) {
                      currentUserIdInDb = currentUserRecord.id;
                      currentUserIdRef.current = currentUserRecord.id;
                    }
                  } catch (error) {
                    console.error('Error fetching current user ID:', error);
                  }
                }

                // Only decrement if this notification was for the current user
                if (updatedNotification.user_id === currentUserIdInDb) {
                  // Decrement unread count
                  setUnreadCount((prev) => Math.max(0, prev - 1));
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✓ Subscribed to payment notifications');
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('Error setting up payment notifications:', error);
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
  }, [organizationId, queryClient, userId, onNotificationClick]);

  return { unreadCount, setUnreadCount };
}

