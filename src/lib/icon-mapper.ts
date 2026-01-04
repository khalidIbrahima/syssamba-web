/**
 * Maps icon name strings to Lucide React icon components
 * Used for dynamic icon loading from database
 */
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
  Shield,
  ChevronRight,
  // Add more icons as needed
} from 'lucide-react';

export type IconComponent = React.ComponentType<{ className?: string }>;

const iconMap: Record<string, IconComponent> = {
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
  Shield,
  ChevronRight,
  // Add aliases
  Dashboard: LayoutDashboard,
  Properties: Building2,
  Units: Home,
  Tenants: Users,
  Owners: UserCircle,
  Leases: FileText,
  Payments: CreditCard,
  Accounting: Calculator,
  Tasks: CheckSquare,
  Messages: MessageSquare,
  Notifications: MessageSquare,
  Admin: Shield,
};

/**
 * Get an icon component by name
 * Returns a default icon if not found
 */
export function getIconByName(iconName: string | null | undefined): IconComponent {
  if (!iconName) {
    return Settings; // Default icon
  }

  return iconMap[iconName] || Settings;
}

/**
 * Check if an icon name is valid
 */
export function isValidIconName(iconName: string | null | undefined): boolean {
  if (!iconName) return false;
  return iconName in iconMap;
}

