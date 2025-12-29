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
  Zap,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import type { ObjectType } from '@/lib/salesforce-inspired-security';

// Type definitions for navigation items with tab-based permissions
interface SubItem {
  name: string;
  href: string;
  tab?: string; // Tab identifier (e.g., 'tenant-payments', 'owner-transfers')
  permission?: string; // Specific permission for this sub-item
  objectType?: ObjectType; // Object type for permission check
  objectAction?: 'read' | 'create' | 'edit' | 'delete'; // Action required
  featureKey?: string; // Optional feature requirement for this sub-item
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: number | null;
  featureKey: string | null;
  permission: string;
  subItems?: SubItem[];
}

// Navigation items with feature requirements and tab-based permissions
const navigationItems: NavigationItem[] = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard, 
    badge: null,
    featureKey: 'dashboard',
    permission: 'canViewAllProperties' as const, // Dashboard accessible if can view properties
  },
  { 
    name: 'Biens', 
    href: '/properties', 
    icon: Building2, 
    badge: null,
    featureKey: 'properties_management',
    permission: 'canViewAllProperties' as const,
  },
  { 
    name: 'Lots', 
    href: '/units', 
    icon: Home, 
    badge: null,
    featureKey: 'units_management',
    permission: 'canViewAllUnits' as const,
  },
  { 
    name: 'Locataires', 
    href: '/tenants', 
    icon: Users, 
    badge: null,
    featureKey: 'tenants_basic',
    permission: 'canViewAllTenants' as const,
  },
  { 
    name: 'Propriétaires', 
    href: '/owners', 
    icon: UserCircle, 
    badge: null,
    featureKey: null, // No specific feature requirement
    permission: 'canViewAllProperties' as const, // Owners accessible if can view properties
  },
  { 
    name: 'Baux', 
    href: '/leases', 
    icon: FileText, 
    badge: null,
    featureKey: 'leases_basic',
    permission: 'canViewAllLeases' as const,
  },
  { 
    name: 'Paiements', 
    href: '/payments', 
    icon: CreditCard, 
    badge: 5,
    featureKey: 'payments_manual_entry',
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
        // featureKey: 'payments_all_methods', // Example: requires higher plan feature
      },
    ]
  },
  { 
    name: 'Comptabilité', 
    href: '/accounting', 
    icon: Calculator, 
    badge: null,
    featureKey: 'accounting_sycoda_basic',
    permission: 'canViewAccounting' as const,
  },
  { 
    name: 'Tâches', 
    href: '/tasks', 
    icon: CheckSquare, 
    badge: 12,
    featureKey: 'basic_tasks',
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
    featureKey: null,
    permission: 'canViewSettings' as const,
  },
  {
    name: 'Fonctionnalités par plan',
    href: '/admin/plan-features',
    icon: Zap,
    badge: null,
    featureKey: null, // Admin only feature
    permission: 'canViewSettings' as const, // Only for admins
  },
];

// Wrapper component to safely use usePlan
function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { limits, currentUsage, plan, definition } = usePlan();
  const { canAccessFeature, canPerformAction, canAccessObject, hasFeature } = useAccess();
  const { isSuperAdmin } = useSuperAdmin();
  
  // Check if user is admin (can edit Organization)
  const isAdmin = canAccessObject('Organization', 'edit');

  /**
   * Check if a sub-item should be visible based on its permissions
   */
  const canAccessSubItem = (subItem: SubItem): boolean => {
    // If sub-item has a feature requirement, check it first
    if (subItem.featureKey && !hasFeature(subItem.featureKey)) {
      return false;
    }

    // If sub-item has objectType and objectAction, use object-level permission check
    if (subItem.objectType && subItem.objectAction) {
      return canAccessObject(subItem.objectType, subItem.objectAction);
    }

    // If sub-item has a specific permission, check it
    if (subItem.permission) {
      // Map permission to object type for access checking
      const permissionToObjectMap: Record<string, ObjectType> = {
        'canViewAllProperties': 'Property',
        'canViewAllUnits': 'Unit',
        'canViewAllTenants': 'Tenant',
        'canViewAllLeases': 'Lease',
        'canViewAllPayments': 'Payment',
        'canViewAllTasks': 'Task',
        'canViewAccounting': 'JournalEntry',
        'canSendMessages': 'Message',
        'canViewSettings': 'Organization',
      };

      const objectType = permissionToObjectMap[subItem.permission];
      if (objectType) {
        return canAccessObject(objectType, 'read');
      }
      return canPerformAction(subItem.permission);
    }

    // If no specific permission, inherit from parent item (default behavior)
    return true;
  };

  // Filter navigation items based on access
  const filteredNavigation = navigationItems
    .filter((item) => {
      // Map permission to object type for access checking
      const permissionToObjectMap: Record<string, ObjectType> = {
        'canViewAllProperties': 'Property',
        'canViewAllUnits': 'Unit',
        'canViewAllTenants': 'Tenant',
        'canViewAllLeases': 'Lease',
        'canViewAllPayments': 'Payment',
        'canViewAllTasks': 'Task',
        'canViewAccounting': 'JournalEntry',
        'canSendMessages': 'Message',
        'canViewSettings': 'Organization',
      };

      // If feature is required, check both feature and permission
      if (item.featureKey) {
        // First check if feature is enabled in plan - if not, don't show item
        if (!hasFeature(item.featureKey)) {
          return false;
        }
        
        // Then check if user has access to the object
        if (item.permission) {
          const objectType = permissionToObjectMap[item.permission];
          if (objectType) {
            // User must have at least read access to the object
            // This allows users with CRUD access to see items even if they don't have "ViewAll"
            return canAccessObject(objectType, 'read');
          }
          // If no object type mapping, check the specific permission
          return canPerformAction(item.permission);
        }
        
        // If no permission required but feature is enabled, show item
        return true;
      }
      
      // If no feature key, check permission only
      if (item.permission) {
        const objectType = permissionToObjectMap[item.permission];
        if (objectType) {
          // User must have at least read access to the object
          return canAccessObject(objectType, 'read');
        }
        // If no object type mapping, check the specific permission
        return canPerformAction(item.permission);
      }
      
      // If no feature key and no permission, don't show item
      return false;
    })
    .map((item) => {
      // Filter sub-items based on their individual permissions
      if (item.subItems && item.subItems.length > 0) {
        return {
          ...item,
          subItems: item.subItems.filter(canAccessSubItem),
        };
      }
      return item;
    })
    // Hide parent items if they have sub-items but none are accessible
    .filter((item) => {
      if (item.subItems && item.subItems.length > 0) {
        return item.subItems.length > 0; // Only show if at least one sub-item is accessible
      }
      return true;
    });

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
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-blue-500 px-4 pb-4">
          {/* Placeholder to maintain layout */}
          <div className="flex h-16 shrink-0 items-center">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                <div className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold text-white">Sys Samba</span>
            </div>
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
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-blue-500 px-4 pb-4" suppressHydrationWarning>
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xl font-bold text-white">Sys Samba</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-1">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href);
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = hasSubItems && isItemExpanded(item.name);
              
              return (
                <li key={item.name}>
                  <div>
                    {hasSubItems ? (
                      <button
                        onClick={() => toggleExpanded(item.name)}
                        className={cn(
                          'group flex items-center justify-between gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-colors w-full',
                          isActive
                            ? 'bg-white text-blue-600'
                            : 'text-white hover:bg-blue-600/80'
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
                        href={item.href}
                        className={cn(
                          'group flex items-center justify-between gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-colors',
                          isActive
                            ? 'bg-white text-blue-600'
                            : 'text-white hover:bg-blue-600/80'
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
                        {item.subItems?.map((subItem: SubItem) => {
                          const subItemParams = new URLSearchParams(subItem.href.split('?')[1] || '');
                          const subItemTab = subItemParams.get('tab');
                          const currentTab = searchParams.get('tab');
                          
                          // Check if this sub-item is active based on tab parameter
                          const isSubActive = pathname === item.href.split('?')[0] && 
                            ((subItemTab && currentTab === subItemTab) ||
                             (!subItemTab && !currentTab && subItem === item.subItems?.[0]));
                          
                          // Check if user has access to this specific sub-item
                          const hasAccess = canAccessSubItem(subItem);
                          
                          // Don't render if user doesn't have access
                          if (!hasAccess) {
                            return null;
                          }
                          
                          return (
                            <li key={subItem.name}>
                              <Link
                                href={subItem.href}
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
            
            {/* Admin Section - Show for both super admins and organization admins */}
            {(isSuperAdmin || isAdmin) && (
              <li>
                <div className="pt-4 border-t border-blue-400">
                  <Link
                    href="/admin"
                    className={cn(
                      'group flex items-center gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-colors',
                      pathname.startsWith('/admin')
                        ? 'bg-white text-blue-600'
                        : 'text-white hover:bg-blue-600/80'
                    )}
                  >
                    <Shield
                      className={cn(
                        'h-5 w-5 shrink-0',
                        pathname.startsWith('/admin') ? 'text-blue-600' : 'text-white'
                      )}
                      aria-hidden="true"
                    />
                    Administration
                  </Link>
                </div>
              </li>
            )}
          </ul>
        </nav>

        {/* Plan Agence Section - Only for admins */}
        {isAdmin && (
          <div className="mt-auto border-t border-blue-400 pt-4">
            <div className="rounded-lg bg-blue-600/50 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">
                Plan {definition?.display_name || (plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Agence')}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/90">
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
                    className="h-2 bg-blue-400" 
                    indicatorClassName="bg-green-500"
                  />
                )}
                <Button
                  size="sm"
                  className="w-full bg-white text-blue-600 hover:bg-white/90 text-xs font-medium mt-2"
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
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-blue-500 px-4 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white animate-pulse" />
            <span className="text-xl font-bold text-white ml-2">Samba Sys</span>
          </div>
        </div>
      </div>
    );
  }

  // Render actual sidebar once client-side
  return <SidebarContent />;
}