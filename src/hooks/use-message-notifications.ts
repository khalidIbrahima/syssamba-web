'use client';

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './use-auth';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MessageNotification {
  id: string;
  senderId: string | null;
  senderName: string | null;
  content: string;
  recipientUserId?: string;
  tenantId?: string | null;
}

/**
 * Hook for real-time message notifications
 * Shows toast notifications when new messages arrive
 */
export function useMessageNotifications(
  organizationId?: string,
  onMessageClick?: (message: MessageNotification) => void
) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Fetch initial unread count and set up polling to refresh it
  useEffect(() => {
    if (!organizationId) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/messages/unread-count', {
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

  useEffect(() => {
    if (!organizationId || !supabase) return;

    let mounted = true;
    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      try {
        const client = supabase;
        if (!client) return;

        // Subscribe to all messages in the organization (INSERT and UPDATE)
        channel = client
          .channel(`messages:org:${organizationId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `organization_id=eq.${organizationId}`,
            },
            async (payload) => {
              if (!mounted) return;

              const newMessage = payload.new as {
                id: string;
                sender_id: string | null;
                sender_type: string;
                tenant_id: string | null;
                content: string;
                recipient_user_id?: string;
                organization_id: string;
              };

              // Use cached current user ID or fetch it if not available
              let currentUserIdInDb = currentUserIdRef.current;

              // If we don't have current user ID yet, try to fetch it
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

              // Don't show notification for messages sent by current user
              if (newMessage.sender_id === currentUserIdInDb) {
                return;
              }

              // For user-to-user messages (tenant_id is null), we need recipient_user_id to know who should receive the notification
              const isUserToUserMessage = !newMessage.tenant_id && newMessage.sender_type === 'staff';
              
              if (isUserToUserMessage) {
                // For user-to-user messages, only show notification if recipient_user_id exists and matches current user
                if (newMessage.recipient_user_id) {
                  // Only show if this message is for the current user
                  if (newMessage.recipient_user_id !== currentUserIdInDb) {
                    console.log('[Notifications] Message not for current user:', {
                      recipientUserId: newMessage.recipient_user_id,
                      currentUserId: currentUserIdInDb,
                    });
                    return; // Not for current user - don't show notification
                  }
                  // Message is for current user - continue to show notification
                  console.log('[Notifications] User-to-user message for current user:', {
                    messageId: newMessage.id,
                    senderId: newMessage.sender_id,
                    recipientUserId: newMessage.recipient_user_id,
                  });
                } else {
                  // No recipient_user_id - this shouldn't happen for user-to-user messages
                  // But we'll skip notification to avoid showing to wrong users
                  console.warn('[Notifications] User-to-user message without recipient_user_id:', newMessage.id);
                  return;
                }
              }
              
              // For tenant messages (tenant_id is not null), show notification to all staff members
              // These are messages from tenants to the organization

              // Get sender name - try to fetch synchronously from payload if available
              let senderName = 'Quelqu\'un';
              
              if (newMessage.sender_type === 'staff' && newMessage.sender_id) {
                try {
                  const { data: sender, error: senderError } = await client
                    .from('users')
                    .select('first_name, last_name')
                    .eq('id', newMessage.sender_id)
                    .maybeSingle();
                  
                  if (!senderError && sender) {
                    const firstName = sender.first_name || '';
                    const lastName = sender.last_name || '';
                    senderName = `${firstName} ${lastName}`.trim();
                    if (!senderName) {
                      senderName = 'Un utilisateur';
                    }
                  } else {
                    console.warn('Could not fetch sender name:', senderError);
                    senderName = 'Un utilisateur';
                  }
                } catch (error) {
                  console.error('Error fetching sender name:', error);
                  senderName = 'Un utilisateur';
                }
              } else if (newMessage.tenant_id) {
                try {
                  const { data: tenant, error: tenantError } = await client
                    .from('tenants')
                    .select('first_name, last_name')
                    .eq('id', newMessage.tenant_id)
                    .maybeSingle();
                  
                  if (!tenantError && tenant) {
                    const firstName = tenant.first_name || '';
                    const lastName = tenant.last_name || '';
                    senderName = `${firstName} ${lastName}`.trim();
                    if (!senderName) {
                      senderName = 'Un locataire';
                    }
                  } else {
                    console.warn('Could not fetch tenant name:', tenantError);
                    senderName = 'Un locataire';
                  }
                } catch (error) {
                  console.error('Error fetching tenant name:', error);
                  senderName = 'Un locataire';
                }
              }

              // Show toast notification
              const messageNotification: MessageNotification = {
                id: newMessage.id,
                senderId: newMessage.sender_id,
                senderName,
                content: newMessage.content || '',
                recipientUserId: newMessage.recipient_user_id,
                tenantId: newMessage.tenant_id,
              };

              const messagePreview = newMessage.content 
                ? (newMessage.content.length > 50 
                    ? newMessage.content.substring(0, 50) + '...' 
                    : newMessage.content)
                : 'Nouveau message';

              toast.info(
                `${senderName}: ${messagePreview}`,
                {
                  duration: 5000,
                  action: {
                    label: 'Ouvrir',
                    onClick: () => {
                      onMessageClick?.(messageNotification);
                    },
                  },
                }
              );

              // Update unread count
              setUnreadCount((prev) => prev + 1);

              // Invalidate messages queries and unread count
              queryClient.invalidateQueries({ queryKey: ['messages'] });
              queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `organization_id=eq.${organizationId}`,
            },
            async (payload) => {
              if (!mounted) return;

              const updatedMessage = payload.new as {
                id: string;
                read_at: string | null;
                recipient_user_id?: string;
                tenant_id: string | null;
              };

              const oldMessage = payload.old as {
                read_at: string | null;
              };

              // If a message was just marked as read (read_at changed from null to a timestamp)
              if (!oldMessage.read_at && updatedMessage.read_at) {
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

                // Only decrement if this message was for the current user
                const isUserToUserMessage = !updatedMessage.tenant_id;
                const isForCurrentUser = isUserToUserMessage 
                  ? updatedMessage.recipient_user_id === currentUserIdInDb
                  : true; // Tenant messages are for all staff

                if (isForCurrentUser) {
                  // Decrement unread count
                  setUnreadCount((prev) => Math.max(0, prev - 1));
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✓ Subscribed to message notifications');
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('Error setting up message notifications:', error);
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
  }, [organizationId, queryClient, userId, onMessageClick]);

  return { unreadCount, setUnreadCount };
}

