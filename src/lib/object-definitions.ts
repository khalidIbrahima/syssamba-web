/**
 * Object Definitions Management
 * Allows super-admins to dynamically add new object types
 */

import { db } from './db';

export interface ObjectDefinition {
  id: string;
  objectKey: string;
  displayName: string;
  description?: string;
  databaseTable?: string;
  ownershipField?: string;
  sensitiveFields: string[];
  icon?: string;
  category?: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all active object definitions
 */
export async function getActiveObjectDefinitions(): Promise<ObjectDefinition[]> {
  try {
    const definitions = await db.select<{
      id: string;
      object_key: string;
      display_name: string;
      description: string | null;
      database_table: string | null;
      ownership_field: string | null;
      sensitive_fields: string[] | null;
      icon: string | null;
      category: string | null;
      is_active: boolean;
      is_system: boolean;
      sort_order: number;
      created_at: string;
      updated_at: string;
    }>('object_definitions', {
      eq: { is_active: true },
      orderBy: { column: 'sort_order', ascending: true },
    });

    return definitions.map((def) => ({
      id: def.id,
      objectKey: def.object_key,
      displayName: def.display_name,
      description: def.description || undefined,
      databaseTable: def.database_table || undefined,
      ownershipField: def.ownership_field || undefined,
      sensitiveFields: def.sensitive_fields || [],
      icon: def.icon || undefined,
      category: def.category || undefined,
      isActive: def.is_active,
      isSystem: def.is_system,
      sortOrder: def.sort_order,
      createdAt: def.created_at,
      updatedAt: def.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching object definitions:', error);
    return [];
  }
}

/**
 * Get a specific object definition by key
 */
export async function getObjectDefinitionByKey(objectKey: string): Promise<ObjectDefinition | null> {
  try {
    const definition = await db.selectOne<{
      id: string;
      object_key: string;
      display_name: string;
      description: string | null;
      database_table: string | null;
      ownership_field: string | null;
      sensitive_fields: string[] | null;
      icon: string | null;
      category: string | null;
      is_active: boolean;
      is_system: boolean;
      sort_order: number;
      created_at: string;
      updated_at: string;
    }>('object_definitions', {
      eq: { object_key: objectKey, is_active: true },
    });

    if (!definition) {
      return null;
    }

    return {
      id: definition.id,
      objectKey: definition.object_key,
      displayName: definition.display_name,
      description: definition.description || undefined,
      databaseTable: definition.database_table || undefined,
      ownershipField: definition.ownership_field || undefined,
      sensitiveFields: definition.sensitive_fields || [],
      icon: definition.icon || undefined,
      category: definition.category || undefined,
      isActive: definition.is_active,
      isSystem: definition.is_system,
      sortOrder: definition.sort_order,
      createdAt: definition.created_at,
      updatedAt: definition.updated_at,
    };
  } catch (error) {
    console.error('Error fetching object definition:', error);
    return null;
  }
}

/**
 * Get ownership field for an object type
 * Returns the ownership field from object definition, or falls back to default
 */
export async function getOwnershipField(objectType: string): Promise<string | null> {
  const definition = await getObjectDefinitionByKey(objectType);
  if (definition?.ownershipField) {
    return definition.ownershipField;
  }

  // Fallback to default ownership fields for system objects
  const defaultOwnershipFields: Record<string, string | null> = {
    Property: 'created_by',
    Unit: 'created_by',
    Tenant: 'created_by',
    Lease: 'created_by',
    Payment: 'created_by',
    Task: 'assigned_to',
    Message: 'sender_id',
    JournalEntry: 'created_by',
    User: null,
    Organization: null,
    Report: 'created_by',
    Activity: 'user_id',
  };

  return defaultOwnershipFields[objectType] || null;
}

/**
 * Get sensitive fields for an object type
 * Returns sensitive fields from object definition, or falls back to default
 */
export async function getSensitiveFields(objectType: string): Promise<string[]> {
  const definition = await getObjectDefinitionByKey(objectType);
  if (definition?.sensitiveFields && definition.sensitiveFields.length > 0) {
    return definition.sensitiveFields;
  }

  // Fallback to default sensitive fields for system objects
  const defaultSensitiveFields: Record<string, string[]> = {
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

  return defaultSensitiveFields[objectType] || [];
}


