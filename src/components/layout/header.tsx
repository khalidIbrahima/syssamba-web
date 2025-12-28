'use client';

import { usePathname } from 'next/navigation';
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
import Link from 'next/link';
import { usePlan } from '@/hooks/use-plan';
import { UserMessageDialog } from '@/components/messaging/user-message-dialog';
import { useMessageNotifications } from '@/hooks/use-message-notifications';
import { usePaymentNotifications } from '@/hooks/use-payment-notifications';
import { useDataQuery } from '@/hooks/use-query';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

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
  const pathname = usePathname();
  const { plan, limits } = usePlan();
  const [isMounted, setIsMounted] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Get current user's organization ID
  const { data: currentUser } = useDataQuery(
    ['current-user'],
    getCurrentUserOrg
  );

  // Set up message notifications
  const { unreadCount: messageUnreadCount, setUnreadCount: setMessageUnreadCount } = useMessageNotifications(
    currentUser?.organizationId,
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

  // Set up payment notifications
  const { unreadCount: paymentUnreadCount, setUnreadCount: setPaymentUnreadCount } = usePaymentNotifications(
    currentUser?.organizationId,
    (notification) => {
      // When payment notification is clicked, navigate to payments page
      window.location.href = '/payments';
    }
  );

  // Total unread count (messages + payments)
  const totalUnreadCount = (messageUnreadCount || 0) + (paymentUnreadCount || 0);
  
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
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8" suppressHydrationWarning>
      <div className="flex flex-1 items-center justify-between gap-4">
        {/* Left: Logo (only on properties page) or Title */}
        {isPropertiesPage ? (
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">SambaOne</span>
          </Link>
        ) : (
          <h1 className="text-xl font-semibold text-gray-900">
            {isDashboardPage ? 'Tableau de bord' : 'Dashboard'}
          </h1>
        )}

        {/* Center: Search Bar (only on properties page) */}
        {isPropertiesPage && (
          <div className="flex-1 max-w-2xl mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
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
              <span className="text-gray-600">Plan:</span>
              <Badge variant="default" className="bg-blue-600 text-white">
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </Badge>
              <span className="text-gray-600">{lotsUsed}/{lotsLimit} lots</span>
            </div>
          )}

          {/* Language Switcher */}
          <div className="hidden md:flex items-center border border-gray-200 rounded-md px-1 py-1 bg-white overflow-hidden">
            <button className="px-2 py-1 text-xs font-bold text-white bg-blue-600">FR</button>
            <button className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900">EN</button>
            <button className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900">WO</button>
          </div>

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
            <Bell className="h-5 w-5 text-gray-600" suppressHydrationWarning />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-bold">
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </span>
            )}
          </Button>

          {/* Messages */}
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
            <MessageSquare className="h-5 w-5 text-gray-600" suppressHydrationWarning />
            {messageUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-bold">
                {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
              </span>
            )}
          </Button>

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