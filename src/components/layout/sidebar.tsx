'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Building2,
  Home,
  Users,
  UserCircle,
  FileText,
  CreditCard,
  Calculator,
  CheckSquare,
  MessageSquare,
  Settings,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { useFeatures } from '@/contexts/FeatureContext';
import { getObjectTypeFromPermission } from '@/lib/permission-mappings';
import type { ObjectType } from '@/lib/salesforce-inspired-security';
import { useMemo } from 'react';
import { useDataQuery } from '@/hooks/use-query';
import { getIconByName } from '@/lib/icon-mapper';
import { Logo } from '@/components/logo';

// Type definitions for navigation items with tab-based permissions
interface SubItem {
  key?: string; // Unique identifier (from API)
  name: string;
  href: string;
  tab?: string; // Tab identifier (e.g., 'tenant-payments', 'owner-transfers')
  permission?: string; // Specific permission for this sub-item
  objectType?: ObjectType; // Object type for permission check
  objectAction?: 'read' | 'create' | 'edit' | 'delete'; // Action required
  featureKey?: string; // Optional feature requirement for this sub-item
}

interface NavigationItem {
  key?: string; // Unique identifier (from API)
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: number | null;
  featureKey: string | null;
  permission: string;
  subItems?: SubItem[];
}

// Fetch navigation items from API
async function fetchNavigationItems() {
  const response = await fetch('/api/navigation/items', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch navigation items');
  }

  const data = await response.json();
  return data.items || [];
}

// Navigation items with feature requirements and tab-based permissions
// DEPRECATED: Now using dynamic navigation items from API
const navigationItemsStatic: NavigationItem[] = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard, 
    badge: null,
    featureKey: null, // Dashboard available to all
    permission: 'canViewAllProperties' as const, // Dashboard accessible if can view properties
  },
  { 
    name: 'Biens', 
    href: '/properties', 
    icon: Building2, 
    badge: null,
    featureKey: 'property_management',
    permission: 'canViewAllProperties' as const,
  },
  { 
    name: 'Lots', 
    href: '/units', 
    icon: Home, 
    badge: null,
    featureKey: 'property_management', // Same as properties
    permission: 'canViewAllUnits' as const,
  },
  { 
    name: 'Locataires', 
    href: '/tenants', 
    icon: Users, 
    badge: null,
    featureKey: 'tenant_management',
    permission: 'canViewAllTenants' as const,
  },
  { 
    name: 'Propriétaires', 
    href: '/owners', 
    icon: UserCircle, 
    badge: null,
    featureKey: 'property_management', // Related to property management
    permission: 'canViewAllProperties' as const, // Owners accessible if can view properties
  },
  { 
    name: 'Baux', 
    href: '/leases', 
    icon: FileText, 
    badge: null,
    featureKey: 'lease_management',
    permission: 'canViewAllLeases' as const,
  },
  { 
    name: 'Paiements', 
    href: '/payments', 
    icon: CreditCard, 
    badge: 5,
    featureKey: 'rent_collection',
    permission: 'canViewAllPayments' as const,
    subItems: [
      { 
        name: 'Paiements locataires', 
        href: '/payments?tab=tenant-payments',
        tab: 'tenant-payments',
        permission: 'canViewAllPayments',
        objectType: 'Payment',
        objectAction: 'read',
      },
      { 
        name: 'Virements propriétaires', 
        href: '/payments?tab=owner-transfers',
        tab: 'owner-transfers',
        permission: 'canViewAllPayments',
        objectType: 'Payment',
        objectAction: 'read',
        // Optional: Can require additional permission for owner transfers
        // featureKey: 'owner_payments', // Example: requires higher plan feature
      },
    ]
  },
  { 
    name: 'Comptabilité', 
    href: '/accounting', 
    icon: Calculator, 
    badge: null,
    featureKey: 'accounting',
    permission: 'canViewAccounting' as const,
  },
  { 
    name: 'Tâches', 
    href: '/tasks', 
    icon: CheckSquare, 
    badge: 12,
    featureKey: 'task_management',
    permission: 'canViewAllTasks' as const,
  },
  { 
    name: 'Messages', 
    href: '/notifications', 
    icon: MessageSquare, 
    badge: null,
    featureKey: 'messaging',
    permission: 'canSendMessages' as const,
  },
  {
    name: 'Paramètres',
    href: '/settings',
    icon: Settings,
    badge: null,
    featureKey: null, // Settings available to all
    permission: 'canViewSettings' as const,
  },
];

// Wrapper component to safely use usePlan
function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { limits, currentUsage, plan, definition } = usePlan();
  const { canAccessObject, canPerformAction } = useAccess();
  const { isFeatureEnabled } = useFeatures();
  const { isSuperAdmin } = useSuperAdmin();
  
  // Fetch navigation items from API
  const { data: apiNavigationItems, isLoading: isLoadingNavItems } = useDataQuery(
    ['navigation-items'],
    fetchNavigationItems
  );
  
  // Transform API items to NavigationItem format
  const navigationItems: NavigationItem[] = useMemo(() => {
    if (!apiNavigationItems || !Array.isArray(apiNavigationItems) || apiNavigationItems.length === 0) {
      return [];
    }

    return apiNavigationItems
      .filter((item: any) => item && item.href && typeof item.href === 'string') // Filter out items without valid href
      .map((item: any) => {
        const IconComponent = getIconByName(item.icon);
        
        return {
          key: item.key, // Add key for unique identification
          name: item.name || 'Unnamed',
          href: item.href, // Guaranteed to be a string after filter
          icon: IconComponent,
          badge: item.badge,
          featureKey: null, // Already filtered by API
          permission: '', // Already filtered by API
          subItems: item.subItems
            ?.filter((subItem: any) => subItem && subItem.href && typeof subItem.href === 'string') // Filter out sub-items without valid href
            .map((subItem: any) => ({
              key: subItem.key || subItem.href, // Use key or href as unique identifier
              name: subItem.name || 'Unnamed',
              href: subItem.href, // Guaranteed to be a string after filter
              tab: subItem.href.includes('tab=') ? new URLSearchParams(subItem.href.split('?')[1] || '').get('tab') || undefined : undefined,
              permission: '', // Already filtered by API
              objectType: undefined,
              objectAction: undefined,
              featureKey: undefined,
            })) || [],
        };
      });
  }, [apiNavigationItems]);
  
  // Check if user is organization admin (can edit Organization)
  // Org admins manage their own organization and should see all sidebar items
  const isOrgAdmin = canAccessObject('Organization', 'edit');
  
  // Alias for backward compatibility
  const isAdmin = isOrgAdmin;

  // Navigation items are already filtered by the API based on:
  // 1. Plan Feature Security
  // 2. Profile Permission Security
  // 3. Profile Navigation Overrides
  // So we can use them directly
  const filteredNavigation = useMemo(() => {
    return navigationItems;
  }, [navigationItems]);

  // Initialize expanded items after mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    // Auto-expand payments if we're on payments page
    if (pathname.startsWith('/payments')) {
      setExpandedItems(['Paiements']);
    }
  }, [pathname]);

  // Don't render until mounted to avoid hydration mismatch from browser extensions
  if (!isMounted) {
    return (
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-blue-500 dark:bg-blue-900/90 px-4 pb-4">
          {/* Placeholder to maintain layout */}
          <div className="flex h-16 shrink-0 items-center">
            <Logo width={140} height={40} className="[&_text]:fill-white" />
          </div>
        </div>
      </div>
    );
  }
  
  // Get real plan usage data
  const lotsUsed = currentUsage?.lots || 0;
  // Handle limits: -1 means unlimited, undefined/null/0 means no limit set (treat as unlimited)
  const lotsLimit = limits.lots === -1 || !limits.lots || limits.lots === 0 
    ? Infinity 
    : limits.lots;
  const lotsPercentage = lotsLimit === Infinity 
    ? 0 
    : Math.min(100, Math.round((lotsUsed / lotsLimit) * 100));

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemExpanded = (itemName: string) => expandedItems.includes(itemName);

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col" suppressHydrationWarning>
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-blue-500 dark:bg-blue-900/90 px-4 pb-4 border-r border-border" suppressHydrationWarning>
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center">
          <Link href="/dashboard" className="flex items-center">
            <Logo width={140} height={40} className="[&_text]:fill-white" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-1">
            {filteredNavigation
              .filter((item) => item && item.href && typeof item.href === 'string') // Additional safety check
              .map((item, index) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href);
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isExpanded = hasSubItems && isItemExpanded(item.name);
                
                // Ensure unique key: use key if available, otherwise use href, fallback to index
                const itemKey = item.key || item.href || `nav-item-${index}`;
                
                return (
                  <li key={itemKey}>
                    <div>
                      {hasSubItems ? (
                        <button
                          onClick={() => toggleExpanded(item.name)}
                          className={cn(
                            'group flex items-center justify-between gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-colors w-full',
                            isActive
                              ? 'bg-white dark:bg-blue-800 text-blue-600 dark:text-blue-100'
                              : 'text-white/90 dark:text-white/80 hover:bg-blue-600/80 dark:hover:bg-blue-800/50'
                          )}
                        >
                          <div className="flex items-center gap-x-3">
                            <item.icon
                              className={cn(
                                'h-5 w-5 shrink-0',
                                isActive ? 'text-blue-600' : 'text-white'
                              )}
                              aria-hidden="true"
                            />
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2">
                            {item.badge && (
                              <Badge 
                                className={cn(
                                  'h-5 min-w-5 px-1.5 text-xs font-bold',
                                  item.name === 'Paiements' 
                                    ? 'bg-red-500 text-white' 
                                    : 'bg-orange-500 text-white'
                                )}
                              >
                                {item.badge}
                              </Badge>
                            )}
                            <ChevronRight
                              className={cn(
                                'h-4 w-4 shrink-0 transition-transform',
                                isExpanded ? 'rotate-90' : '',
                                isActive ? 'text-blue-600' : 'text-white'
                              )}
                            />
                          </div>
                        </button>
                      ) : (
                        <Link
                          href={item.href || '#'}
                        className={cn(
                          'group flex items-center justify-between gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-colors',
                          isActive
                            ? 'bg-white dark:bg-blue-800 text-blue-600 dark:text-blue-100'
                            : 'text-white/90 dark:text-white/80 hover:bg-blue-600/80 dark:hover:bg-blue-800/50'
                        )}
                      >
                        <div className="flex items-center gap-x-3">
                          <item.icon
                            className={cn(
                              'h-5 w-5 shrink-0',
                              isActive ? 'text-blue-600 dark:text-blue-100' : 'text-white/90 dark:text-white/80'
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
                        </div>
                        {item.badge && (
                          <Badge 
                            className={cn(
                              'h-5 min-w-5 px-1.5 text-xs font-bold',
                              item.name === 'Paiements' 
                                ? 'bg-red-500 text-white' 
                                : 'bg-orange-500 text-white'
                            )}
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    )}
                    
                    {/* Sub-items */}
                    {hasSubItems && isExpanded && (
                      <ul className="ml-4 mt-1 space-y-1">
                        {item.subItems
                          ?.filter((subItem: SubItem) => subItem && subItem.href && typeof subItem.href === 'string') // Additional safety check
                          .map((subItem: SubItem, subIndex: number) => {
                            const subItemParams = new URLSearchParams(subItem.href.split('?')[1] || '');
                            const subItemTab = subItemParams.get('tab');
                            const currentTab = searchParams.get('tab');
                            
                            // Check if this sub-item is active based on tab parameter
                            const isSubActive = pathname === item.href.split('?')[0] && 
                              ((subItemTab && currentTab === subItemTab) ||
                               (!subItemTab && !currentTab && subItem === item.subItems?.[0]));
                            
                            // Ensure unique key for sub-items
                            const subItemKey = subItem.key || subItem.href || `${itemKey}-sub-${subIndex}`;
                            
                            // Sub-items are already filtered by API, so render all
                            return (
                              <li key={subItemKey}>
                                <Link
                                  href={subItem.href || '#'}
                                className={cn(
                                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                                  isSubActive
                                    ? 'bg-white/20 text-white font-medium'
                                    : 'text-white/70 hover:text-white hover:bg-white/10'
                                )}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {subItem.name}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
            
            {/* Admin Section - Show only for super admins */}
            {isSuperAdmin && (
              <>
                <li>
                  <div className="pt-4 border-t border-blue-400">
                    <Link
                      href="/admin/dashboard"
                      className={cn(
                        'group flex items-center gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-colors',
                        pathname === '/admin/dashboard' || pathname.startsWith('/admin/dashboard')
                          ? 'bg-white text-blue-600'
                          : 'text-white hover:bg-blue-600/80'
                      )}
                    >
                      <LayoutDashboard
                        className={cn(
                          'h-5 w-5 shrink-0',
                          pathname === '/admin/dashboard' || pathname.startsWith('/admin/dashboard') ? 'text-blue-600' : 'text-white'
                        )}
                        aria-hidden="true"
                      />
                      Dashboard
                    </Link>
                  </div>
                </li>
                <li>
                  <Link
                    href="/admin"
                    className={cn(
                      'group flex items-center gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-colors',
                      pathname.startsWith('/admin') && pathname !== '/admin/dashboard' && !pathname.startsWith('/admin/dashboard')
                        ? 'bg-white text-blue-600'
                        : 'text-white hover:bg-blue-600/80'
                    )}
                  >
                    <Shield
                      className={cn(
                        'h-5 w-5 shrink-0',
                        pathname.startsWith('/admin') && pathname !== '/admin/dashboard' && !pathname.startsWith('/admin/dashboard') ? 'text-blue-600' : 'text-white'
                      )}
                      aria-hidden="true"
                    />
                    Administration
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* Plan Agence Section - Only for admins */}
        {isAdmin && (
          <div className="mt-auto border-t border-blue-400 dark:border-blue-700 pt-4">
            <div className="rounded-lg bg-blue-600/50 dark:bg-blue-800/50 p-4">
              <h3 className="text-sm font-semibold text-white dark:text-white mb-2">
                Plan {definition?.display_name || (plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Agence')}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/90 dark:text-white/80">
                  <span>
                    {lotsUsed}/{lotsLimit === Infinity ? '∞' : lotsLimit} lots utilisés
                  </span>
                  {lotsLimit !== Infinity && lotsLimit > 0 && !isNaN(lotsPercentage) && (
                    <span>{lotsPercentage}%</span>
                  )}
                </div>
                {lotsLimit !== Infinity && lotsLimit > 0 && !isNaN(lotsPercentage) && (
                  <Progress 
                    value={lotsPercentage} 
                    className="h-2 bg-blue-400 dark:bg-blue-700" 
                    indicatorClassName="bg-green-500 dark:bg-green-400"
                  />
                )}
                <Button
                  size="sm"
                  className="w-full bg-white dark:bg-blue-700 text-blue-600 dark:text-white hover:bg-white/90 dark:hover:bg-blue-600 text-xs font-medium mt-2"
                  asChild
                >
                  <Link href="/settings/subscription">Gérer l'abonnement</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Sidebar component with QueryClient check
export function Sidebar() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Render placeholder during SSR or if QueryClient is not available
  if (!isClient) {
    return (
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-blue-500 dark:bg-blue-900/90 px-4 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <Logo width={140} height={40} className="[&_text]:fill-white animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Render actual sidebar once client-side
  return <SidebarContent />;
}