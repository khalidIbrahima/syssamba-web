// Role-based permissions for SAMBA SYS
// Defines what each role can access and do

export type UserRole = 'owner' | 'admin' | 'accountant' | 'agent' | 'viewer';

export interface RolePermissions {
  // View permissions
  canViewAllTasks: boolean;
  canViewOwnTasks: boolean;
  canViewAllMessages: boolean;
  canViewOwnMessages: boolean;
  canViewAllProperties: boolean;
  canViewAllUnits: boolean;
  canViewAllTenants: boolean;
  canViewAllLeases: boolean;
  canViewAllPayments: boolean;
  canViewAccounting: boolean;
  canViewReports: boolean;
  canViewUsers: boolean;
  canViewSettings: boolean;

  // Create permissions
  canCreateTasks: boolean;
  canCreateProperties: boolean;
  canCreateUnits: boolean;
  canCreateTenants: boolean;
  canCreateLeases: boolean;
  canCreatePayments: boolean;
  canCreateJournalEntries: boolean;
  canCreateUsers: boolean;
  canSendMessages: boolean;

  // Edit permissions
  canEditTasks: boolean;
  canEditOwnTasks: boolean;
  canEditProperties: boolean;
  canEditUnits: boolean;
  canEditTenants: boolean;
  canEditLeases: boolean;
  canEditPayments: boolean;
  canEditJournalEntries: boolean;
  canEditUsers: boolean;
  canEditSettings: boolean;

  // Delete permissions
  canDeleteTasks: boolean;
  canDeleteOwnTasks: boolean;
  canDeleteProperties: boolean;
  canDeleteUnits: boolean;
  canDeleteTenants: boolean;
  canDeleteLeases: boolean;
  canDeletePayments: boolean;
  canDeleteJournalEntries: boolean;
  canDeleteUsers: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: {
    // View - full access
    canViewAllTasks: true,
    canViewOwnTasks: true,
    canViewAllMessages: true,
    canViewOwnMessages: true,
    canViewAllProperties: true,
    canViewAllUnits: true,
    canViewAllTenants: true,
    canViewAllLeases: true,
    canViewAllPayments: true,
    canViewAccounting: true,
    canViewReports: true,
    canViewUsers: true,
    canViewSettings: true,

    // Create - full access
    canCreateTasks: true,
    canCreateProperties: true,
    canCreateUnits: true,
    canCreateTenants: true,
    canCreateLeases: true,
    canCreatePayments: true,
    canCreateJournalEntries: true,
    canCreateUsers: true,
    canSendMessages: true,

    // Edit - full access
    canEditTasks: true,
    canEditOwnTasks: true,
    canEditProperties: true,
    canEditUnits: true,
    canEditTenants: true,
    canEditLeases: true,
    canEditPayments: true,
    canEditJournalEntries: true,
    canEditUsers: true,
    canEditSettings: true,

    // Delete - full access
    canDeleteTasks: true,
    canDeleteOwnTasks: true,
    canDeleteProperties: true,
    canDeleteUnits: true,
    canDeleteTenants: true,
    canDeleteLeases: true,
    canDeletePayments: true,
    canDeleteJournalEntries: true,
    canDeleteUsers: true,
  },
  admin: {
    // View - full access except some settings
    canViewAllTasks: true,
    canViewOwnTasks: true,
    canViewAllMessages: true,
    canViewOwnMessages: true,
    canViewAllProperties: true,
    canViewAllUnits: true,
    canViewAllTenants: true,
    canViewAllLeases: true,
    canViewAllPayments: true,
    canViewAccounting: true,
    canViewReports: true,
    canViewUsers: true,
    canViewSettings: true,

    // Create - full access
    canCreateTasks: true,
    canCreateProperties: true,
    canCreateUnits: true,
    canCreateTenants: true,
    canCreateLeases: true,
    canCreatePayments: true,
    canCreateJournalEntries: true,
    canCreateUsers: true,
    canSendMessages: true,

    // Edit - full access
    canEditTasks: true,
    canEditOwnTasks: true,
    canEditProperties: true,
    canEditUnits: true,
    canEditTenants: true,
    canEditLeases: true,
    canEditPayments: true,
    canEditJournalEntries: true,
    canEditUsers: true,
    canEditSettings: false, // Cannot edit subscription/billing

    // Delete - full access
    canDeleteTasks: true,
    canDeleteOwnTasks: true,
    canDeleteProperties: true,
    canDeleteUnits: true,
    canDeleteTenants: true,
    canDeleteLeases: true,
    canDeletePayments: true,
    canDeleteJournalEntries: true,
    canDeleteUsers: true,
  },
  accountant: {
    // View - accounting focused
    canViewAllTasks: false,
    canViewOwnTasks: true,
    canViewAllMessages: false,
    canViewOwnMessages: true,
    canViewAllProperties: true,
    canViewAllUnits: true,
    canViewAllTenants: true,
    canViewAllLeases: true,
    canViewAllPayments: true,
    canViewAccounting: true,
    canViewReports: true,
    canViewUsers: false,
    canViewSettings: false,

    // Create - accounting focused
    canCreateTasks: false,
    canCreateProperties: false,
    canCreateUnits: false,
    canCreateTenants: false,
    canCreateLeases: false,
    canCreatePayments: true,
    canCreateJournalEntries: true,
    canCreateUsers: false,
    canSendMessages: true,

    // Edit - accounting focused
    canEditTasks: false,
    canEditOwnTasks: true,
    canEditProperties: false,
    canEditUnits: false,
    canEditTenants: false,
    canEditLeases: false,
    canEditPayments: true,
    canEditJournalEntries: true,
    canEditUsers: false,
    canEditSettings: false,

    // Delete - limited
    canDeleteTasks: false,
    canDeleteOwnTasks: true,
    canDeleteProperties: false,
    canDeleteUnits: false,
    canDeleteTenants: false,
    canDeleteLeases: false,
    canDeletePayments: false,
    canDeleteJournalEntries: true,
    canDeleteUsers: false,
  },
  agent: {
    // View - operational access
    canViewAllTasks: true,
    canViewOwnTasks: true,
    canViewAllMessages: true,
    canViewOwnMessages: true,
    canViewAllProperties: true,
    canViewAllUnits: true,
    canViewAllTenants: true,
    canViewAllLeases: true,
    canViewAllPayments: true,
    canViewAccounting: false,
    canViewReports: true,
    canViewUsers: false,
    canViewSettings: false,

    // Create - operational
    canCreateTasks: true,
    canCreateProperties: true,
    canCreateUnits: true,
    canCreateTenants: true,
    canCreateLeases: true,
    canCreatePayments: true,
    canCreateJournalEntries: false,
    canCreateUsers: false,
    canSendMessages: true,

    // Edit - operational
    canEditTasks: true,
    canEditOwnTasks: true,
    canEditProperties: true,
    canEditUnits: true,
    canEditTenants: true,
    canEditLeases: true,
    canEditPayments: true,
    canEditJournalEntries: false,
    canEditUsers: false,
    canEditSettings: false,

    // Delete - limited
    canDeleteTasks: false,
    canDeleteOwnTasks: true,
    canDeleteProperties: false,
    canDeleteUnits: false,
    canDeleteTenants: false,
    canDeleteLeases: false,
    canDeletePayments: false,
    canDeleteJournalEntries: false,
    canDeleteUsers: false,
  },
  viewer: {
    // View - read-only
    canViewAllTasks: true,
    canViewOwnTasks: true,
    canViewAllMessages: true,
    canViewOwnMessages: true,
    canViewAllProperties: true,
    canViewAllUnits: true,
    canViewAllTenants: true,
    canViewAllLeases: true,
    canViewAllPayments: true,
    canViewAccounting: false,
    canViewReports: true,
    canViewUsers: false,
    canViewSettings: false,

    // Create - none
    canCreateTasks: false,
    canCreateProperties: false,
    canCreateUnits: false,
    canCreateTenants: false,
    canCreateLeases: false,
    canCreatePayments: false,
    canCreateJournalEntries: false,
    canCreateUsers: false,
    canSendMessages: false,

    // Edit - none
    canEditTasks: false,
    canEditOwnTasks: false,
    canEditProperties: false,
    canEditUnits: false,
    canEditTenants: false,
    canEditLeases: false,
    canEditPayments: false,
    canEditJournalEntries: false,
    canEditUsers: false,
    canEditSettings: false,

    // Delete - none
    canDeleteTasks: false,
    canDeleteOwnTasks: false,
    canDeleteProperties: false,
    canDeleteUnits: false,
    canDeleteTenants: false,
    canDeleteLeases: false,
    canDeletePayments: false,
    canDeleteJournalEntries: false,
    canDeleteUsers: false,
  },
};

/**
 * Get permissions for a role
 */
export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: UserRole,
  permission: keyof RolePermissions
): boolean {
  const permissions = getRolePermissions(role);
  return permissions[permission] || false;
}

/**
 * Check if user can view all tasks or only own tasks
 */
export function canViewAllTasks(role: UserRole): boolean {
  return hasPermission(role, 'canViewAllTasks');
}

/**
 * Check if user can view all messages or only own messages
 */
export function canViewAllMessages(role: UserRole): boolean {
  return hasPermission(role, 'canViewAllMessages');
}

