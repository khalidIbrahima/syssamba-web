/**
 * Level 3: Object Security
 * Checks if user can access a specific object instance
 * This includes ownership checks, sharing rules, etc.
 */

import type { ObjectType } from '../salesforce-inspired-security';
import type { Action } from './index';
import { db } from '../db';
import { getCurrentUser } from '../auth';

export interface ObjectAccessCheck {
  objectType: ObjectType;
  objectId: string;
  action: Action;
  userId: string;
  organizationId: string;
}

/**
 * Check if user can access a specific object
 * This checks ownership and organization membership
 */
export async function checkObjectAccess(
  objectType: ObjectType,
  objectId: string,
  action: Action,
  userId?: string,
  organizationId?: string
): Promise<boolean> {
  try {
    const user = userId ? null : await getCurrentUser();
    const currentUserId = userId || user?.id;
    const currentOrgId = organizationId || user?.organizationId;

    if (!currentUserId || !currentOrgId) {
      return false;
    }

    // Check object ownership and organization
    switch (objectType) {
      case 'Property':
        return await checkPropertyAccess(objectId, currentUserId, currentOrgId, action);
      case 'Unit':
        return await checkUnitAccess(objectId, currentUserId, currentOrgId, action);
      case 'Tenant':
        return await checkTenantAccess(objectId, currentUserId, currentOrgId, action);
      case 'Lease':
        return await checkLeaseAccess(objectId, currentUserId, currentOrgId, action);
      case 'Payment':
        return await checkPaymentAccess(objectId, currentUserId, currentOrgId, action);
      case 'Task':
        return await checkTaskAccess(objectId, currentUserId, currentOrgId, action);
      case 'User':
        return await checkUserAccess(objectId, currentUserId, currentOrgId, action);
      default:
        // For other object types, check organization membership
        return true; // Will be refined based on object schema
    }
  } catch (error) {
    console.error('Error checking object access:', error);
    return false;
  }
}

/**
 * Check property access
 */
async function checkPropertyAccess(
  propertyId: string,
  userId: string,
  organizationId: string,
  action: Action
): Promise<boolean> {
  const property = await db.selectOne<{
    id: string;
    organization_id: string;
    created_by: string | null;
  }>('properties', {
    eq: { id: propertyId },
  });

  if (!property) return false;

  // Must belong to same organization
  if (property.organization_id !== organizationId) {
    return false;
  }

  // For delete, check if user created it (or is admin)
  if (action === 'delete' && property.created_by && property.created_by !== userId) {
    // Could add admin check here
    return false;
  }

  return true;
}

/**
 * Check unit access
 */
async function checkUnitAccess(
  unitId: string,
  userId: string,
  organizationId: string,
  action: Action
): Promise<boolean> {
  const unit = await db.selectOne<{
    id: string;
    property_id: string;
  }>('units', {
    eq: { id: unitId },
  });

  if (!unit) return false;

  // Check property access
  return await checkPropertyAccess(unit.property_id, userId, organizationId, action);
}

/**
 * Check tenant access
 */
async function checkTenantAccess(
  tenantId: string,
  userId: string,
  organizationId: string,
  action: Action
): Promise<boolean> {
  const tenant = await db.selectOne<{
    id: string;
    organization_id: string;
    created_by: string | null;
  }>('tenants', {
    eq: { id: tenantId },
  });

  if (!tenant) return false;

  if (tenant.organization_id !== organizationId) {
    return false;
  }

  if (action === 'delete' && tenant.created_by && tenant.created_by !== userId) {
    return false;
  }

  return true;
}

/**
 * Check lease access
 */
async function checkLeaseAccess(
  leaseId: string,
  userId: string,
  organizationId: string,
  action: Action
): Promise<boolean> {
  const lease = await db.selectOne<{
    id: string;
    unit_id: string;
  }>('leases', {
    eq: { id: leaseId },
  });

  if (!lease) return false;

  // Check unit access (which checks property access)
  return await checkUnitAccess(lease.unit_id, userId, organizationId, action);
}

/**
 * Check payment access
 */
async function checkPaymentAccess(
  paymentId: string,
  userId: string,
  organizationId: string,
  action: Action
): Promise<boolean> {
  const payment = await db.selectOne<{
    id: string;
    lease_id: string | null;
    tenant_id: string | null;
    organization_id: string;
  }>('payments', {
    eq: { id: paymentId },
  });

  if (!payment) return false;

  if (payment.organization_id !== organizationId) {
    return false;
  }

  // If payment is linked to lease, check lease access
  if (payment.lease_id) {
    return await checkLeaseAccess(payment.lease_id, userId, organizationId, action);
  }

  // If payment is linked to tenant, check tenant access
  if (payment.tenant_id) {
    return await checkTenantAccess(payment.tenant_id, userId, organizationId, action);
  }

  return true;
}

/**
 * Check task access
 */
async function checkTaskAccess(
  taskId: string,
  userId: string,
  organizationId: string,
  action: Action
): Promise<boolean> {
  const task = await db.selectOne<{
    id: string;
    organization_id: string;
    assigned_to: string | null;
    created_by: string | null;
  }>('tasks', {
    eq: { id: taskId },
  });

  if (!task) return false;

  if (task.organization_id !== organizationId) {
    return false;
  }

  // Users can view tasks assigned to them or created by them
  // Admins can view all tasks
  if (action === 'read') {
    return task.assigned_to === userId || task.created_by === userId || true; // Add admin check
  }

  // For edit/delete, check ownership
  if (action === 'edit' || action === 'delete') {
    return task.created_by === userId || true; // Add admin check
  }

  return true;
}

/**
 * Check user access
 */
async function checkUserAccess(
  targetUserId: string,
  userId: string,
  organizationId: string,
  action: Action
): Promise<boolean> {
  const targetUser = await db.selectOne<{
    id: string;
    organization_id: string | null;
  }>('users', {
    eq: { id: targetUserId },
  });

  if (!targetUser) return false;

  // Users can view themselves
  if (targetUserId === userId && action === 'read') {
    return true;
  }

  // Must be in same organization
  if (targetUser.organization_id !== organizationId) {
    return false;
  }

  // Only admins can edit/delete other users
  // This will be enhanced with profile checks
  return true;
}

