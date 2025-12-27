# Sidebar Tab-Based Permissions System

## Overview

This document describes the tab-based permission system for sidebar navigation items. This system allows you to define granular permissions for each tab/sub-item within a navigation section.

## Structure

### NavigationItem Interface

```typescript
interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: number | null;
  featureKey: string | null; // Plan feature requirement
  permission: string; // Base permission for the main item
  subItems?: SubItem[]; // Optional sub-items/tabs
}
```

### SubItem Interface

```typescript
interface SubItem {
  name: string;
  href: string;
  tab?: string; // Tab identifier (e.g., 'tenant-payments', 'owner-transfers')
  permission?: string; // Specific permission for this sub-item
  objectType?: ObjectType; // Object type for permission check
  objectAction?: 'read' | 'create' | 'edit' | 'delete'; // Action required
  featureKey?: string; // Optional feature requirement for this sub-item
}
```

## How It Works

### 1. Parent Item Permissions

The parent navigation item (e.g., "Paiements") is checked first:
- **Feature Check**: Is the feature enabled in the plan? (`featureKey`)
- **Permission Check**: Does the user have the required permission? (`permission`)

### 2. Sub-Item Permissions

Each sub-item (tab) is then checked individually:
- **Feature Check**: If `featureKey` is specified, check if feature is enabled
- **Object-Level Check**: If `objectType` and `objectAction` are specified, check object permissions
- **Permission Check**: If `permission` is specified, check the specific permission
- **Inheritance**: If no specific permissions are set, the sub-item inherits from the parent

### 3. Filtering Logic

1. Filter parent items based on their permissions
2. For each parent item with sub-items, filter sub-items based on their individual permissions
3. Hide parent items if all their sub-items are filtered out

## Examples

### Example 1: Payments with Different Tab Permissions

```typescript
{
  name: 'Paiements',
  href: '/payments',
  icon: CreditCard,
  badge: 5,
  featureKey: 'payments_manual_entry',
  permission: 'canViewAllPayments',
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
      // Optional: Require higher plan feature
      featureKey: 'payments_all_methods',
    },
  ]
}
```

### Example 2: Settings with Admin-Only Tabs

```typescript
{
  name: 'Paramètres',
  href: '/settings',
  icon: Settings,
  badge: null,
  featureKey: null,
  permission: 'canViewSettings',
  subItems: [
    {
      name: 'Général',
      href: '/settings',
      tab: 'general',
      // Inherits parent permission
    },
    {
      name: 'Utilisateurs',
      href: '/settings/users',
      tab: 'users',
      objectType: 'User',
      objectAction: 'read', // Requires read access to User object
    },
    {
      name: 'Profils & Permissions',
      href: '/settings/profiles',
      tab: 'profiles',
      objectType: 'User',
      objectAction: 'edit', // Requires edit access to User object (admin only)
    },
  ]
}
```

### Example 3: Accounting with Feature-Based Tabs

```typescript
{
  name: 'Comptabilité',
  href: '/accounting',
  icon: Calculator,
  badge: null,
  featureKey: 'accounting_sycoda_basic',
  permission: 'canViewAccounting',
  subItems: [
    {
      name: 'Journal',
      href: '/accounting',
      tab: 'journal',
      // Inherits parent permissions
    },
    {
      name: 'Balance',
      href: '/accounting/balance',
      tab: 'balance',
      objectType: 'JournalEntry',
      objectAction: 'read',
    },
    {
      name: 'DSF',
      href: '/accounting/dsf',
      tab: 'dsf',
      featureKey: 'dsf_export', // Requires higher plan feature
      objectType: 'JournalEntry',
      objectAction: 'read',
    },
  ]
}
```

## Permission Check Priority

For each sub-item, permissions are checked in this order:

1. **Feature Check** (`featureKey`): If specified, feature must be enabled in plan
2. **Object-Level Check** (`objectType` + `objectAction`): If specified, user must have the action permission on the object
3. **Permission Check** (`permission`): If specified, check the specific permission string
4. **Inheritance**: If none specified, inherit from parent item

## Implementation Details

### Filtering Function

The `canAccessSubItem` function checks each sub-item:

```typescript
const canAccessSubItem = (subItem: SubItem): boolean => {
  // 1. Check feature requirement
  if (subItem.featureKey && !hasFeature(subItem.featureKey)) {
    return false;
  }

  // 2. Check object-level permission
  if (subItem.objectType && subItem.objectAction) {
    return canAccessObject(subItem.objectType, subItem.objectAction);
  }

  // 3. Check specific permission
  if (subItem.permission) {
    // ... permission check logic
  }

  // 4. Inherit from parent (default: true)
  return true;
};
```

### Rendering Logic

Sub-items are filtered before rendering:

```typescript
// Filter sub-items
const filteredSubItems = item.subItems?.filter(canAccessSubItem) || [];

// Only show parent if at least one sub-item is accessible
if (filteredSubItems.length === 0) {
  return null; // Hide parent item
}
```

## Best Practices

1. **Always define `tab` identifier** for sub-items that use query parameters
2. **Use `objectType` and `objectAction`** for object-level permission checks (more granular)
3. **Use `featureKey`** when a tab requires a specific plan feature
4. **Use `permission`** for legacy permission strings (less preferred)
5. **Don't duplicate parent permissions** - let sub-items inherit when appropriate

## Migration Guide

To add tab-based permissions to an existing navigation item:

1. Add `subItems` array to the navigation item
2. Define permissions for each sub-item
3. Update the page component to check tab permissions (optional, for extra security)
4. Test with different user profiles to ensure correct filtering

## Security Notes

- Tab permissions are checked on the **client-side** for UI filtering
- **Always verify permissions on the server-side** in API routes and page components
- Tab permissions should complement, not replace, server-side security checks

