/**
 * Centralized permission to object type mappings
 * 
 * This file provides a single source of truth for mapping permission strings
 * (like 'canViewAllProperties') to their corresponding ObjectType values
 * (like 'Property').
 * 
 * This mapping is used throughout the application for:
 * - Sidebar navigation filtering
 * - Tab permission checks
 * - Access control validation
 */

import type { ObjectType } from './salesforce-inspired-security';

/**
 * Maps permission strings to their corresponding ObjectType
 * 
 * This is the reverse mapping of the objectToFeatureMap in use-access.ts
 * 
 * @example
 * getObjectTypeFromPermission('canViewAllProperties') // returns 'Property'
 * getObjectTypeFromPermission('canViewAccounting') // returns 'JournalEntry'
 */
export const PERMISSION_TO_OBJECT_TYPE_MAP: Record<string, ObjectType> = {
  // Property-related permissions
  'canViewAllProperties': 'Property',
  'canCreateProperties': 'Property',
  'canEditProperties': 'Property',
  'canDeleteProperties': 'Property',
  
  // Unit-related permissions
  'canViewAllUnits': 'Unit',
  'canCreateUnits': 'Unit',
  'canEditUnits': 'Unit',
  'canDeleteUnits': 'Unit',
  
  // Tenant-related permissions
  'canViewAllTenants': 'Tenant',
  'canCreateTenants': 'Tenant',
  'canEditTenants': 'Tenant',
  'canDeleteTenants': 'Tenant',
  
  // Lease-related permissions
  'canViewAllLeases': 'Lease',
  'canCreateLeases': 'Lease',
  'canEditLeases': 'Lease',
  'canDeleteLeases': 'Lease',
  
  // Payment-related permissions
  'canViewAllPayments': 'Payment',
  'canCreatePayments': 'Payment',
  'canEditPayments': 'Payment',
  'canDeletePayments': 'Payment',
  
  // Task-related permissions
  'canViewAllTasks': 'Task',
  'canCreateTasks': 'Task',
  'canEditTasks': 'Task',
  'canDeleteTasks': 'Task',
  
  // Message-related permissions
  'canSendMessages': 'Message',
  'canViewAllMessages': 'Message',
  
  // Accounting-related permissions
  'canViewAccounting': 'JournalEntry',
  'canCreateJournalEntries': 'JournalEntry',
  'canEditJournalEntries': 'JournalEntry',
  
  // User-related permissions
  'canViewAllUsers': 'User',
  'canCreateUsers': 'User',
  'canEditUsers': 'User',
  'canDeleteUsers': 'User',
  
  // Organization-related permissions
  'canViewSettings': 'Organization',
  
  // Profile-related permissions
  'canManageProfiles': 'Profile',
  'canCreateProfiles': 'Profile',
  'canEditProfiles': 'Profile',
  'canDeleteProfiles': 'Profile',
  
  // Report-related permissions
  'canViewReports': 'Report',
  'canCreateReports': 'Report',
  
  // Activity-related permissions
  'canViewActivities': 'Activity',
};

/**
 * Get the ObjectType for a given permission string
 * 
 * @param permission - The permission string (e.g., 'canViewAllProperties')
 * @returns The corresponding ObjectType or undefined if not found
 * 
 * @example
 * getObjectTypeFromPermission('canViewAllProperties') // returns 'Property'
 * getObjectTypeFromPermission('invalidPermission') // returns undefined
 */
export function getObjectTypeFromPermission(permission: string): ObjectType | undefined {
  return PERMISSION_TO_OBJECT_TYPE_MAP[permission];
}

/**
 * Check if a permission string has a corresponding ObjectType mapping
 * 
 * @param permission - The permission string to check
 * @returns true if the permission has a mapping, false otherwise
 */
export function hasObjectTypeMapping(permission: string): boolean {
  return permission in PERMISSION_TO_OBJECT_TYPE_MAP;
}

