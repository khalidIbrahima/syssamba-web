'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSuperAdmin } from './use-super-admin';

/**
 * Hook for admin notifications
 * Shows notifications for super admins (organization created, subscription created, etc.)
 */
export function useAdminNotifications(
  onNotificationClick?: (notification: { id: string; type: string; content: string | null }) => void
) {
  const { isSuperAdmin } = useSuperAdmin();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!isSuperAdmin) return 0;

    try {
      const response = await fetch('/api/admin/notifications/unread-count', {
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[useAdminNotifications] Failed to fetch unread count');
        return 0;
      }

      const data = await response.json();
      return data.unreadCount || 0;
    } catch (error) {
      console.error('[useAdminNotifications] Error fetching unread count:', error);
      return 0;
    }
  }, [isSuperAdmin]);

  // Poll for unread count every 30 seconds
  const { data: count } = useQuery({
    queryKey: ['admin-notifications-unread-count'],
    queryFn: fetchUnreadCount,
    enabled: isSuperAdmin === true,
    refetchInterval: 30000, // Poll every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Update unread count when data changes
  useEffect(() => {
    if (typeof count === 'number') {
      setUnreadCount(count);
    }
  }, [count]);

  // Mark as read function
  const markAsRead = useCallback(async (notificationId?: string) => {
    if (!isSuperAdmin) return;

    try {
      const response = await fetch('/api/admin/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        // Invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['admin-notifications-unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      }
    } catch (error) {
      console.error('[useAdminNotifications] Error marking as read:', error);
    }
  }, [isSuperAdmin, queryClient]);

  return {
    unreadCount,
    markAsRead,
  };
}

