/**
 * Salesforce-Inspired Security System
 * 
 * Multi-layered security model:
 * 1. Object-Level Security (OLS) - Controls access to objects/tables
 * 2. Field-Level Security (FLS) - Controls access to specific fields
 * 3. Record-Level Security (RLS) - Controls access to individual records
 * 4. Profile - Base set of permissions (equivalent to our roles)
 * 5. Permission Sets - Additional permissions (equivalent to custom roles)
 * 6. Role Hierarchy - Hierarchical access to records
 * 7. Sharing Rules - Automatic sharing rules
 */

import type { UserRole } from './role-permissions';
import type { PlanName } from './permissions';

// ============================================================================
// 1. OBJECT-LEVEL SECURITY (OLS)
// ============================================================================

// Base object types (system objects)
export type BaseObjectType = 
  | 'Property'
  | 'Unit'
  | 'Tenant'
  | 'Lease'
  | 'Payment'
  | 'Task'
  | 'Message'
  | 'JournalEntry'
  | 'User'
  | 'Organization'
  | 'Profile'
  | 'Report'
  | 'Activity';

// Dynamic object types can be added by super-admins
// This type allows both base types and any string (for dynamic objects)
export type ObjectType = BaseObjectType | string;

export type ObjectAccessLevel = 'None' | 'Read' | 'ReadWrite' | 'All';

export interface ObjectPermission {
  objectType: ObjectType;
  accessLevel: ObjectAccessLevel;
  canCreate: boolean;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewAll: boolean; // Can view all records vs only own
}

// ============================================================================
// 2. FIELD-LEVEL SECURITY (FLS)
// ============================================================================

export type FieldAccessLevel = 'None' | 'Read' | 'ReadWrite';

export interface FieldPermission {
  objectType: ObjectType;
  fieldName: string;
  accessLevel: FieldAccessLevel;
  canRead: boolean;
  canEdit: boolean;
}

// Common sensitive fields that might need FLS
// Note: For dynamic objects, use getSensitiveFields() from object-definitions.ts
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  Property: ['purchasePrice', 'purchaseDate', 'mortgageDetails'],
  Unit: ['rentAmount', 'chargesAmount', 'depositAmount'],
  Tenant: ['email', 'phone', 'idNumber', 'bankDetails'],
  Lease: ['rentAmount', 'depositAmount', 'terms'],
  Payment: ['amount', 'paymentMethod', 'transactionId', 'bankDetails'],
  Task: ['assignedTo', 'dueDate', 'priority'],
  Message: ['content', 'attachments'],
  JournalEntry: ['amount', 'account', 'description'],
  User: ['email', 'phone', 'role', 'salary'],
  Organization: ['stripeCustomerId', 'billingEmail', 'plan'],
  Report: ['data', 'filters'],
  Activity: ['details', 'metadata'],
};

// ============================================================================
// 3. RECORD-LEVEL SECURITY (RLS) - Simplified
// ============================================================================

// Record ownership fields (for basic ownership checks)
export const OWNERSHIP_FIELDS: Record<ObjectType, string | null> = {
  Property: 'created_by',
  Unit: 'created_by',
  Tenant: 'created_by',
  Lease: 'created_by',
  Payment: 'created_by',
  Task: 'assigned_to', // Tasks use assigned_to instead of created_by
  Message: 'sender_id',
  JournalEntry: 'created_by',
  User: null, // Users don't have ownership
  Organization: null, // Organizations don't have ownership
  Profile: 'organization_id', // Profiles belong to organizations (or null for system profiles)
  Report: 'created_by',
  Activity: 'user_id',
};

// ============================================================================
// 4. COMPREHENSIVE SECURITY CHECK
// ============================================================================

export interface SecurityContext {
  userId: string;
  organizationId: string;
  profileId: string | null; // Profile ID instead of role
  plan: PlanName;
  permissions: Record<string, boolean>; // From profile permissions
  customRoles?: string[]; // Additional permission sets (deprecated)
}

export interface RecordContext {
  objectType: ObjectType;
  recordId?: string;
  ownerId?: string | null;
  organizationId: string;
  fields?: Record<string, any>; // For field-level checks
}

/**
 * Comprehensive security check combining OLS and FLS
 * Returns the effective access level for a user on a specific record
 */
export async function checkRecordAccess(
  securityContext: SecurityContext,
  recordContext: RecordContext,
  action: 'read' | 'edit' | 'delete' | 'create'
): Promise<boolean> {
  const { objectType, ownerId, organizationId } = recordContext;
  const { userId, profileId } = securityContext;

  // 1. Check Object-Level Security (OLS) - using profile instead of role
  if (!profileId) {
    return false;
  }

  // Import profile permissions function
  const { getProfileObjectPermissions } = await import('./profiles');
  const objectPermissions = await getProfileObjectPermissions(profileId);
  const objectPermission = objectPermissions.find(p => p.objectType === objectType);
  
  if (!objectPermission) {
    return false;
  }

  // Check action at object level
  switch (action) {
    case 'create':
      if (!objectPermission.canCreate) return false;
      break;
    case 'read':
      if (!objectPermission.canRead) return false;
      break;
    case 'edit':
      if (!objectPermission.canEdit) return false;
      break;
    case 'delete':
      if (!objectPermission.canDelete) return false;
      break;
  }

  // 2. Basic Record-Level Security (RLS) - only for existing records
  if (action !== 'create' && recordContext.recordId) {
    // Check if user owns the record
    if (ownerId && ownerId === userId) {
      return true; // Owner has full access
    }

    // Check if user can view all records of this type
    if (!objectPermission.canViewAll) {
      // User can only view own records
      if (ownerId !== userId) {
        return false;
      }
    }

    // Check organization boundary
    if (recordContext.organizationId !== securityContext.organizationId) {
      return false; // Cross-organization access denied
    }
  }

  return true;
}

/**
 * Check field-level access
 * Now uses profile-based permissions instead of role-based
 */
export async function checkFieldAccess(
  securityContext: SecurityContext,
  objectType: ObjectType,
  fieldName: string,
  action: 'read' | 'edit'
): Promise<boolean> {
  const { profileId } = securityContext;

  if (!profileId) {
    return false;
  }

  // Get field permission (from profile)
  const { getProfileFieldPermissions } = await import('./profiles');
  const fieldPermissions = await getProfileFieldPermissions(profileId, objectType);
  const fieldPermission = fieldPermissions.find(fp => fp.fieldName === fieldName);

  if (!fieldPermission) {
    return false;
  }

  if (action === 'read') {
    return fieldPermission.canRead;
  }

  if (action === 'edit') {
    return fieldPermission.canEdit;
  }

  return false;
}

/**
 * @deprecated Use getProfileObjectPermissions from profiles.ts instead
 * This function is kept for backward compatibility but should not be used for security checks
 */
function getObjectPermission(
  role: UserRole,
  objectType: ObjectType,
  customPermissions?: Record<string, boolean>
): ObjectPermission | null {
  // DEPRECATED: This function uses role-based permissions
  // Use getProfileObjectPermissions from profiles.ts instead
  console.warn('getObjectPermission is deprecated. Use getProfileObjectPermissions instead.');
  
  // This would typically come from the database (plan_role_permissions)
  // For now, return a basic permission based on role
  // In production, this should query the database

  const basePermissions: Record<UserRole, Partial<Record<ObjectType, ObjectPermission>>> = {
    owner: {
      Property: { objectType: 'Property', accessLevel: 'All', canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
      Unit: { objectType: 'Unit', accessLevel: 'All', canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
      Tenant: { objectType: 'Tenant', accessLevel: 'All', canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
      // ... other objects
    },
    admin: {
      Property: { objectType: 'Property', accessLevel: 'ReadWrite', canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
      // ... other objects
    },
    accountant: {
      Payment: { objectType: 'Payment', accessLevel: 'ReadWrite', canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
      JournalEntry: { objectType: 'JournalEntry', accessLevel: 'ReadWrite', canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
      // ... other objects
    },
    agent: {
      Property: { objectType: 'Property', accessLevel: 'ReadWrite', canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
      Unit: { objectType: 'Unit', accessLevel: 'ReadWrite', canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
      // ... other objects
    },
    viewer: {
      Property: { objectType: 'Property', accessLevel: 'Read', canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
      // ... other objects
    },
  };

  const rolePermissions = basePermissions[role];
  if (!rolePermissions) {
    return null;
  }

  const objectPermission = rolePermissions[objectType];
  if (!objectPermission) {
    return null;
  }

  // Merge with custom permissions if provided
  if (customPermissions) {
    // Custom permissions can override base permissions
    // Implementation depends on how custom permissions are structured
  }

  return objectPermission as ObjectPermission;
}

/**
 * @deprecated Use getProfileFieldPermissions from profiles.ts instead
 * This function is kept for backward compatibility but should not be used for security checks
 */
function getFieldPermission(
  role: UserRole,
  objectType: ObjectType,
  fieldName: string,
  customPermissions?: Record<string, boolean>
): FieldPermission | null {
  // DEPRECATED: This function uses role-based permissions
  // Use getProfileFieldPermissions from profiles.ts instead
  console.warn('getFieldPermission is deprecated. Use getProfileFieldPermissions instead.');
  
  // Check if field is sensitive
  const sensitiveFields = SENSITIVE_FIELDS[objectType] || [];
  const isSensitive = sensitiveFields.includes(fieldName);

  // DEPRECATED: This logic uses role-based permissions
  // Default: all fields are readable/editable unless sensitive
  // Sensitive fields require special permissions
  if (isSensitive) {
    // Only owner and admin can access sensitive fields by default
    // NOTE: This is deprecated - use profile-based permissions instead
    if (role !== 'owner' && role !== 'admin') {
      return {
        objectType,
        fieldName,
        accessLevel: 'None',
        canRead: false,
        canEdit: false,
      };
    }
  }

  // DEPRECATED: Non-sensitive fields: readable by all, editable based on role
  // NOTE: This is deprecated - use profile-based permissions instead
  const canEdit = role !== 'viewer';

  return {
    objectType,
    fieldName,
    accessLevel: canEdit ? 'ReadWrite' : 'Read',
    canRead: true,
    canEdit,
  };
}

/**
 * Filter record fields based on field-level security
 * Now uses profile-based permissions instead of role-based
 */
export async function filterRecordFields(
  securityContext: SecurityContext,
  objectType: ObjectType,
  record: Record<string, any>
): Promise<Record<string, any>> {
  const filtered: Record<string, any> = {};

  for (const [fieldName, value] of Object.entries(record)) {
    if (await checkFieldAccess(securityContext, objectType, fieldName, 'read')) {
      filtered[fieldName] = value;
    }
  }

  return filtered;
}

