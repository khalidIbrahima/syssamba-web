'use client';

import { usePathname } from '@/i18n/routing';
import { useState, useEffect } from 'react';
import { Bell, MessageSquare, Download, Search, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from '@/i18n/routing';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { UserMessageDialog } from '@/components/messaging/user-message-dialog';
import { useMessageNotifications } from '@/hooks/use-message-notifications';
import { usePaymentNotifications } from '@/hooks/use-payment-notifications';
import { useSupportTicketNotifications } from '@/hooks/use-support-ticket-notifications';
import { useDataQuery } from '@/hooks/use-query';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslations } from 'next-intl';
import { Ticket } from 'lucide-react';
import { Logo } from '@/components/logo';

// Fetch current user's organization ID
async function getCurrentUserOrg() {
  const response = await fetch('/api/user/current', {
    credentials: 'include',
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const { plan, limits } = usePlan();
  const { canAccessFeature, canPerformAction } = useAccess();
  const [isMounted, setIsMounted] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Check if user has access to messaging feature
  // Requires: messaging feature enabled in plan AND canSendMessages permission
  const canAccessMessaging = canAccessFeature('messaging', 'canSendMessages') || 
                             canPerformAction('canSendMessages') || 
                             canPerformAction('canViewAllMessages');

  // Check if realtime is disabled via environment variable
  const isRealtimeDisabled = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_REALTIME_DISABLED === 'true';

  // Get current user's organization ID
  const { data: currentUser } = useDataQuery(
    ['current-user'],
    getCurrentUserOrg
  );

  // Set up message notifications (only if user has access to messaging and realtime is enabled)
  const { unreadCount: messageUnreadCount, setUnreadCount: setMessageUnreadCount } = useMessageNotifications(
    canAccessMessaging && !isRealtimeDisabled ? currentUser?.organizationId : null, // Only fetch if user has access and realtime is enabled
    (message) => {
      // When notification is clicked, open message dialog
      setIsMessageDialogOpen(true);
      if (message.recipientUserId) {
        setSelectedUserId(message.recipientUserId);
      } else if (message.senderId) {
        setSelectedUserId(message.senderId);
      }
    }
  );

  // Set up payment notifications (only if realtime is enabled)
  const { unreadCount: paymentUnreadCount, setUnreadCount: setPaymentUnreadCount } = usePaymentNotifications(
    !isRealtimeDisabled ? currentUser?.organizationId : null, // Only fetch if realtime is enabled
    (notification) => {
      // When payment notification is clicked, navigate to payments page
      window.location.href = '/payments';
    }
  );

  // Set up support ticket notifications (only for super-admins)
  const { unreadCount: supportTicketUnreadCount, markAsRead: markSupportTicketsAsRead } = useSupportTicketNotifications(
    (ticket) => {
      // When new ticket notification is clicked, navigate to support tickets page
      window.location.href = '/admin/support-tickets';
    }
  );

  // Total unread count (messages + payments + support tickets)
  // Only include messages if user has access to messaging
  // Only include payments if realtime is enabled
  const totalUnreadCount = (canAccessMessaging && !isRealtimeDisabled ? (messageUnreadCount || 0) : 0) + 
                           (!isRealtimeDisabled ? (paymentUnreadCount || 0) : 0) + 
                           (supportTicketUnreadCount || 0);
  
  // Mock data for plan usage
  const lotsUsed = 47;
  const lotsLimit = limits.lots === -1 ? 100 : limits.lots;
  
  // Check if we're on properties page to show different header
  const isPropertiesPage = pathname === '/properties';
  const isDashboardPage = pathname === '/dashboard';

  // Only check on client side to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8" suppressHydrationWarning>
      <div className="flex flex-1 items-center justify-between gap-4">
        {/* Left: Logo (only on properties page) or Title */}
        {isPropertiesPage ? (
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <Logo width={120} height={40} />
          </Link>
        ) : (
          <h1 className="text-xl font-semibold text-foreground">
            {isDashboardPage ? t('nav.dashboard') : t('nav.dashboard')}
          </h1>
        )}

        {/* Center: Search Bar (only on properties page) */}
        {isPropertiesPage && (
          <div className="flex-1 max-w-2xl mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Rechercher un bien, lot, locataire..."
                className="pl-10 w-full"
              />
            </div>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-x-3 lg:gap-x-4 shrink-0">
          {/* Plan Info (only on properties page) */}
          {isPropertiesPage && (
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Plan:</span>
              <Badge variant="default" className="bg-blue-600 text-white">
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </Badge>
              <span className="text-muted-foreground">{lotsUsed}/{lotsLimit} lots</span>
            </div>
          )}

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Support Tickets Notification (Super Admin only) */}
          {supportTicketUnreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="relative"
              suppressHydrationWarning
              onClick={() => {
                markSupportTicketsAsRead();
                window.location.href = '/admin/support-tickets';
              }}
              title={`${supportTicketUnreadCount} nouveau${supportTicketUnreadCount > 1 ? 'x' : ''} ticket${supportTicketUnreadCount > 1 ? 's' : ''} de support`}
            >
              <Ticket className="h-5 w-5 text-orange-600" suppressHydrationWarning />
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-xs text-white flex items-center justify-center font-bold animate-pulse">
                {supportTicketUnreadCount > 9 ? '9+' : supportTicketUnreadCount}
              </span>
            </Button>
          )}

          {/* Notifications */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="relative" 
            suppressHydrationWarning
            onClick={async () => {
              // Mark all notifications as read when opening
              try {
                await fetch('/api/notifications/mark-read', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({}),
                });
                // Refresh unread count
                const countResponse = await fetch('/api/notifications/unread-count', {
                  credentials: 'include',
                });
                if (countResponse.ok) {
                  const data = await countResponse.json();
                  setPaymentUnreadCount(data.unreadCount || 0);
                }
              } catch (error) {
                console.error('Error marking notifications as read:', error);
              }
            }}
          >
            <Bell className="h-5 w-5 text-muted-foreground" suppressHydrationWarning />
            {!isRealtimeDisabled && (messageUnreadCount || 0) + (paymentUnreadCount || 0) > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-bold">
                {(messageUnreadCount || 0) + (paymentUnreadCount || 0) > 9 ? '9+' : (messageUnreadCount || 0) + (paymentUnreadCount || 0)}
              </span>
            )}
          </Button>

          {/* Messages - Only show if user has access to messaging */}
          {canAccessMessaging && (
            <Button 
              variant="ghost"
              suppressHydrationWarning 
              size="sm"
              className="relative"
              onClick={async () => {
                setIsMessageDialogOpen(true);
                setSelectedUserId(null);
                
                // Mark all messages as read when opening the dialog
                try {
                  await fetch('/api/messages/mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({}),
                  });
                  // Refresh unread count
                  const countResponse = await fetch('/api/messages/unread-count', {
                    credentials: 'include',
                  });
                  if (countResponse.ok) {
                    const data = await countResponse.json();
                    setMessageUnreadCount(data.unreadCount || 0);
                  }
                } catch (error) {
                  console.error('Error marking messages as read:', error);
                }
              }}
            >
              <MessageSquare className="h-5 w-5 text-muted-foreground" suppressHydrationWarning />
              {messageUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-bold">
                  {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
                </span>
              )}
            </Button>
          )}

          {/* User Profile Avatar */}
          <ProfileAvatar className="hidden md:flex" />

          {/* Period Selector (only on dashboard) */}
          {isDashboardPage && (
            <Select defaultValue="this-month">
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">Ce mois</SelectItem>
                <SelectItem value="last-month">Mois dernier</SelectItem>
                <SelectItem value="this-year">Cette année</SelectItem>
                <SelectItem value="last-year">Année dernière</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Export Button (only on dashboard) */}
          {isDashboardPage && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          )}
        </div>
      </div>

      {/* Message Dialog */}
      <UserMessageDialog 
        open={isMessageDialogOpen} 
        onOpenChange={(open) => {
          setIsMessageDialogOpen(open);
          if (!open) {
            setSelectedUserId(null);
            setMessageUnreadCount(0);
          }
        }}
        {...(selectedUserId && { initialSelectedUserId: selectedUserId })}
      />
    </div>
  );
}