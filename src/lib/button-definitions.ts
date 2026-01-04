/**
 * Button Definitions
 * Central mapping of all buttons in the system
 * These definitions are used to automatically sync with object permissions
 */

export type ButtonAction = 'create' | 'read' | 'update' | 'edit' | 'delete' | 'view' | 'export' | 'import' | 'print' | 'custom';
export type ObjectType = 'Property' | 'Unit' | 'Tenant' | 'Lease' | 'Payment' | 'Task' | 'Message' | 'JournalEntry' | 'User' | 'Organization' | 'Report' | 'Activity';

export interface ButtonDefinition {
  key: string;
  name: string;
  label: string;
  objectType: ObjectType;
  action: ButtonAction;
  icon?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  tooltip?: string;
  description?: string;
}

/**
 * Map button actions to object permission fields
 */
export function getPermissionFieldForAction(action: ButtonAction): 'canCreate' | 'canRead' | 'canEdit' | 'canDelete' {
  switch (action) {
    case 'create':
      return 'canCreate';
    case 'read':
    case 'view':
      return 'canRead';
    case 'update':
    case 'edit':
      return 'canEdit';
    case 'delete':
      return 'canDelete';
    case 'export':
    case 'import':
    case 'print':
    case 'custom':
    default:
      return 'canRead'; // Default to read permission for custom actions
  }
}

/**
 * All button definitions in the system
 */
export const BUTTON_DEFINITIONS: ButtonDefinition[] = [
  // Property buttons
  { key: 'property.create', name: 'Créer un bien', label: 'Créer un bien', objectType: 'Property', action: 'create', icon: 'Plus', variant: 'default' },
  { key: 'property.edit', name: 'Modifier un bien', label: 'Modifier', objectType: 'Property', action: 'edit', icon: 'Edit', variant: 'outline', size: 'sm' },
  { key: 'property.delete', name: 'Supprimer un bien', label: 'Supprimer', objectType: 'Property', action: 'delete', icon: 'Trash2', variant: 'destructive', size: 'sm' },
  { key: 'property.view', name: 'Voir un bien', label: 'Voir', objectType: 'Property', action: 'view', icon: 'Eye', variant: 'ghost', size: 'sm' },
  
  // Tenant buttons
  { key: 'tenant.create', name: 'Créer un locataire', label: 'Créer un locataire', objectType: 'Tenant', action: 'create', icon: 'UserPlus', variant: 'default' },
  { key: 'tenant.edit', name: 'Modifier un locataire', label: 'Modifier', objectType: 'Tenant', action: 'edit', icon: 'Edit', variant: 'outline', size: 'sm' },
  { key: 'tenant.delete', name: 'Supprimer un locataire', label: 'Supprimer', objectType: 'Tenant', action: 'delete', icon: 'Trash2', variant: 'destructive', size: 'sm' },
  
  // Lease buttons
  { key: 'lease.create', name: 'Créer un bail', label: 'Créer un bail', objectType: 'Lease', action: 'create', icon: 'FileText', variant: 'default' },
  { key: 'lease.edit', name: 'Modifier un bail', label: 'Modifier', objectType: 'Lease', action: 'edit', icon: 'Edit', variant: 'outline', size: 'sm' },
  { key: 'lease.delete', name: 'Supprimer un bail', label: 'Supprimer', objectType: 'Lease', action: 'delete', icon: 'Trash2', variant: 'destructive', size: 'sm' },
  
  // Payment buttons
  { key: 'payment.create', name: 'Enregistrer un paiement', label: 'Enregistrer un paiement', objectType: 'Payment', action: 'create', icon: 'CreditCard', variant: 'default' },
  { key: 'payment.edit', name: 'Modifier un paiement', label: 'Modifier', objectType: 'Payment', action: 'edit', icon: 'Edit', variant: 'outline', size: 'sm' },
  { key: 'payment.delete', name: 'Supprimer un paiement', label: 'Supprimer', objectType: 'Payment', action: 'delete', icon: 'Trash2', variant: 'destructive', size: 'sm' },
  { key: 'payment.export', name: 'Exporter les paiements', label: 'Exporter', objectType: 'Payment', action: 'export', icon: 'Download', variant: 'outline', size: 'sm' },
  
  // Journal Entry buttons
  { key: 'journal.create', name: 'Créer une écriture', label: 'Nouvelle Écriture', objectType: 'JournalEntry', action: 'create', icon: 'Plus', variant: 'default' },
  { key: 'journal.edit', name: 'Modifier une écriture', label: 'Modifier', objectType: 'JournalEntry', action: 'edit', icon: 'Edit', variant: 'outline', size: 'sm' },
  { key: 'journal.delete', name: 'Supprimer une écriture', label: 'Supprimer', objectType: 'JournalEntry', action: 'delete', icon: 'Trash2', variant: 'destructive', size: 'sm' },
  { key: 'journal.validate', name: 'Valider une écriture', label: 'Valider', objectType: 'JournalEntry', action: 'custom', icon: 'CheckCircle', variant: 'default', size: 'sm' },
  
  // Task buttons
  { key: 'task.create', name: 'Créer une tâche', label: 'Créer une tâche', objectType: 'Task', action: 'create', icon: 'Plus', variant: 'default' },
  { key: 'task.edit', name: 'Modifier une tâche', label: 'Modifier', objectType: 'Task', action: 'edit', icon: 'Edit', variant: 'outline', size: 'sm' },
  { key: 'task.delete', name: 'Supprimer une tâche', label: 'Supprimer', objectType: 'Task', action: 'delete', icon: 'Trash2', variant: 'destructive', size: 'sm' },
  
  // User buttons
  { key: 'user.create', name: 'Inviter un utilisateur', label: 'Inviter utilisateur', objectType: 'User', action: 'create', icon: 'UserPlus', variant: 'default' },
  { key: 'user.edit', name: 'Modifier un utilisateur', label: 'Modifier', objectType: 'User', action: 'edit', icon: 'Edit', variant: 'outline', size: 'sm' },
  { key: 'user.delete', name: 'Supprimer un utilisateur', label: 'Supprimer', objectType: 'User', action: 'delete', icon: 'Trash2', variant: 'destructive', size: 'sm' },
];

/**
 * Get button definition by key
 */
export function getButtonDefinition(key: string): ButtonDefinition | undefined {
  return BUTTON_DEFINITIONS.find((btn) => btn.key === key);
}

/**
 * Get all buttons for a specific object type
 */
export function getButtonsForObjectType(objectType: ObjectType): ButtonDefinition[] {
  return BUTTON_DEFINITIONS.filter((btn) => btn.objectType === objectType);
}

/**
 * Get all buttons for a specific action
 */
export function getButtonsForAction(action: ButtonAction): ButtonDefinition[] {
  return BUTTON_DEFINITIONS.filter((btn) => btn.action === action);
}

