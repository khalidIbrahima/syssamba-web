/**
 * Hook for real-time support ticket notifications
 * Only for super-admins - alerts when new support tickets are created
 */

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSuperAdmin } from './use-super-admin';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  organization_id: string;
  created_at: string;
}

export function useSupportTicketNotifications(
  onNewTicket?: (ticket: SupportTicket) => void
) {
  const queryClient = useQueryClient();
  const { isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();
  const [unreadCount, setUnreadCount] = useState(0);
  const [newTickets, setNewTickets] = useState<SupportTicket[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTicketIdRef = useRef<string | null>(null);

  // Fetch initial unread count (tickets with status 'open')
  useEffect(() => {
    // Check if real-time is disabled via environment variable FIRST
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_REALTIME_DISABLED === 'true') {
      console.log('[useSupportTicketNotifications] Real-time disabled - skipping unread count fetch');
      setUnreadCount(0); // Reset to 0 when disabled
      return;
    }

    if (!isSuperAdmin || isSuperAdminLoading) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/support/tickets?status=open&limit=1000', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const openTickets = data.tickets || [];
          setUnreadCount(openTickets.length);
          
          // Store the latest ticket ID to avoid showing old tickets as new
          if (openTickets.length > 0) {
            lastTicketIdRef.current = openTickets[0].id;
          }
        }
      } catch (error) {
        console.error('Error fetching support ticket count:', error);
      }
    };

    fetchUnreadCount();
  }, [isSuperAdmin, isSuperAdminLoading]);

  // Set up real-time subscription for new tickets
  useEffect(() => {
    if (!isSuperAdmin || isSuperAdminLoading || !supabase) return;

    // Check if real-time is disabled via environment variable
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_REALTIME_DISABLED === 'true') {
      console.log('[useSupportTicketNotifications] Real-time disabled via NEXT_PUBLIC_REALTIME_DISABLED');
      return;
    }

    let mounted = true;
    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      try {
        const client = supabase;

        if (!client) {
          console.warn('Supabase client not available for support ticket notifications');
          return;
        }

        // Subscribe to INSERT events on support_tickets table
        // Super admins should see all new tickets regardless of organization
        channel = client
          .channel('support-tickets:all')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'support_tickets',
            },
            (payload) => {
              if (!mounted) return;

              const newTicket = payload.new as SupportTicket;

              // Ignore if this is the ticket we already know about
              if (lastTicketIdRef.current === newTicket.id) {
                return;
              }

              console.log('New support ticket created:', newTicket);

              // Update unread count
              setUnreadCount((prev) => prev + 1);

              // Add to new tickets list
              setNewTickets((prev) => [newTicket, ...prev].slice(0, 10)); // Keep last 10

              // Show toast notification
              toast.info(`Nouveau ticket de support: ${newTicket.ticket_number}`, {
                description: newTicket.subject,
                duration: 5000,
                action: {
                  label: 'Voir',
                  onClick: () => {
                    window.location.href = '/admin/support-tickets';
                  },
                },
              });

              // Call custom callback if provided
              onNewTicket?.(newTicket);

              // Invalidate queries to refresh ticket list
              queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✓ Subscribed to support ticket notifications');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('✗ Error subscribing to support ticket notifications');
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('Error setting up support ticket notification subscription:', error);
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
  }, [isSuperAdmin, isSuperAdminLoading, queryClient, onNewTicket]);

  // Function to mark tickets as read (when user views the tickets page)
  const markAsRead = () => {
    setUnreadCount(0);
    setNewTickets([]);
  };

  return {
    unreadCount,
    newTickets,
    markAsRead,
    isSuperAdmin,
  };
}

