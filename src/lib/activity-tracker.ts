import { db } from './db';

export type EntityType = 
  | 'property' 
  | 'unit' 
  | 'tenant' 
  | 'lease' 
  | 'payment' 
  | 'journal_entry' 
  | 'task' 
  | 'user'
  | 'organization'
  | 'subscription';

export type ActivityAction = 
  | 'created' 
  | 'updated' 
  | 'deleted' 
  | 'status_changed' 
  | 'assigned' 
  | 'unassigned'
  | 'activated'
  | 'deactivated'
  | 'archived'
  | 'restored'
  | 'payment_received'
  | 'payment_failed'
  | 'payment_refunded';

export interface ActivityMetadata {
  [key: string]: any;
}

export interface CreateActivityParams {
  organizationId: string;
  entityType: EntityType;
  entityId: string;
  userId: string | null;
  action: ActivityAction;
  description: string;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: ActivityMetadata;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an activity log entry
 * This function is safe to call and will not throw errors if activity logging fails
 */
export async function createActivity(params: CreateActivityParams): Promise<void> {
  try {
    await db.insert('activities', {
      organization_id: params.organizationId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      user_id: params.userId,
      action: params.action,
      field_name: params.fieldName || null,
      old_value: params.oldValue || null,
      new_value: params.newValue || null,
      description: params.description,
      metadata: params.metadata || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    });
  } catch (error) {
    // Log the error but don't fail the operation if activity logging fails
    console.warn('Failed to create activity log:', error);
  }
}

/**
 * Create activity for entity creation
 */
export async function logEntityCreated(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
  userId: string | null,
  entityName: string,
  metadata?: ActivityMetadata
): Promise<void> {
  await createActivity({
    organizationId,
    entityType,
    entityId,
    userId,
    action: 'created',
    description: `${entityType === 'property' ? 'Bien' : 
                   entityType === 'unit' ? 'Lot' :
                   entityType === 'tenant' ? 'Locataire' :
                   entityType === 'lease' ? 'Bail' :
                   entityType === 'payment' ? 'Paiement' :
                   entityType === 'journal_entry' ? 'Écriture comptable' :
                   entityType === 'task' ? 'Tâche' :
                   entityType === 'user' ? 'Utilisateur' :
                   entityType === 'organization' ? 'Organisation' :
                   'Entité'} "${entityName}" créé${entityType === 'property' ? 'e' : ''}`,
    metadata,
  });
}

/**
 * Create activity for entity update
 */
export async function logEntityUpdated(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
  userId: string | null,
  changes: Array<{
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
  }>,
  entityName: string,
  metadata?: ActivityMetadata
): Promise<void> {
  if (changes.length === 0) return;

  // If only one field changed, create a single activity
  if (changes.length === 1) {
    const change = changes[0];
    await createActivity({
      organizationId,
      entityType,
      entityId,
      userId,
      action: 'updated',
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      description: `${entityType === 'property' ? 'Bien' : 
                     entityType === 'unit' ? 'Lot' :
                     entityType === 'tenant' ? 'Locataire' :
                     entityType === 'lease' ? 'Bail' :
                     entityType === 'payment' ? 'Paiement' :
                     entityType === 'journal_entry' ? 'Écriture comptable' :
                     entityType === 'task' ? 'Tâche' :
                     entityType === 'user' ? 'Utilisateur' :
                     'Entité'} "${entityName}" mis à jour: ${change.fieldName}`,
      metadata,
    });
  } else {
    // If multiple fields changed, create a single activity with all changes in metadata
    await createActivity({
      organizationId,
      entityType,
      entityId,
      userId,
      action: 'updated',
      description: `${entityType === 'property' ? 'Bien' : 
                     entityType === 'unit' ? 'Lot' :
                     entityType === 'tenant' ? 'Locataire' :
                     entityType === 'lease' ? 'Bail' :
                     entityType === 'payment' ? 'Paiement' :
                     entityType === 'journal_entry' ? 'Écriture comptable' :
                     entityType === 'task' ? 'Tâche' :
                     entityType === 'user' ? 'Utilisateur' :
                     'Entité'} "${entityName}" mis à jour`,
      metadata: {
        ...metadata,
        changes,
      },
    });
  }
}

/**
 * Create activity for entity deletion
 */
export async function logEntityDeleted(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
  userId: string | null,
  entityName: string,
  metadata?: ActivityMetadata
): Promise<void> {
  await createActivity({
    organizationId,
    entityType,
    entityId,
    userId,
    action: 'deleted',
    description: `${entityType === 'property' ? 'Bien' : 
                   entityType === 'unit' ? 'Lot' :
                   entityType === 'tenant' ? 'Locataire' :
                   entityType === 'lease' ? 'Bail' :
                   entityType === 'payment' ? 'Paiement' :
                   entityType === 'journal_entry' ? 'Écriture comptable' :
                   entityType === 'task' ? 'Tâche' :
                   entityType === 'user' ? 'Utilisateur' :
                   'Entité'} "${entityName}" supprimé${entityType === 'property' ? 'e' : ''}`,
    metadata,
  });
}

/**
 * Create activity for status change
 */
export async function logStatusChanged(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
  userId: string | null,
  oldStatus: string | null,
  newStatus: string,
  entityName: string,
  metadata?: ActivityMetadata
): Promise<void> {
  await createActivity({
    organizationId,
    entityType,
    entityId,
    userId,
    action: 'status_changed',
    fieldName: 'status',
    oldValue: oldStatus,
    newValue: newStatus,
    description: `${entityType === 'property' ? 'Bien' : 
                   entityType === 'unit' ? 'Lot' :
                   entityType === 'tenant' ? 'Locataire' :
                   entityType === 'lease' ? 'Bail' :
                   entityType === 'payment' ? 'Paiement' :
                   entityType === 'task' ? 'Tâche' :
                   'Entité'} "${entityName}": statut changé de "${oldStatus || 'N/A'}" à "${newStatus}"`,
    metadata,
  });
}

/**
 * Get user IP address and user agent from request headers
 */
export function getRequestMetadata(headers: Headers): {
  ipAddress?: string;
  userAgent?: string;
} {
  const ipAddress = 
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined;
  
  const userAgent = headers.get('user-agent') || undefined;

  return { ipAddress, userAgent };
}

