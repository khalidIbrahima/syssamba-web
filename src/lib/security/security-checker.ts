/**
 * Main Security Checker
 * Combines all security levels in hierarchical order
 */

import type { PlanName } from '../permissions';
import type { ObjectType } from '../salesforce-inspired-security';
import type { Action, SecurityCheckResult, SecurityLevel } from './index';
import { checkPlanFeature } from './plan-security';
import { checkProfilePermission, checkProfileFieldPermission } from './profile-security';
import { checkObjectAccess } from './object-security';
import { checkFieldAccess } from './field-security';
import { getCurrentUser } from '../auth';

export interface SecurityCheckOptions {
  planName: PlanName;
  profileId: string | null;
  featureKey?: string;
  objectType?: ObjectType;
  objectId?: string;
  action: Action;
  fieldName?: string;
  userId?: string;
  organizationId?: string;
}

/**
 * Perform a complete security check across all levels
 * Returns the first level that fails, or success if all pass
 */
export async function checkSecurity(
  options: SecurityCheckOptions
): Promise<SecurityCheckResult> {
  const {
    planName,
    profileId,
    featureKey,
    objectType,
    objectId,
    action,
    fieldName,
    userId,
    organizationId,
  } = options;

  // Get current user if not provided
  let currentUserId = userId;
  let currentOrgId = organizationId;

  if (!currentUserId || !currentOrgId) {
    const user = await getCurrentUser();
    currentUserId = currentUserId || user?.id;
    currentOrgId = currentOrgId || user?.organizationId;
  }

  if (!currentUserId || !currentOrgId) {
    return {
      allowed: false,
      reason: 'User not authenticated',
      failedLevel: 'plan',
    };
  }

  // Level 1: Plan Feature Security
  if (featureKey) {
    const planAllowed = await checkPlanFeature(planName, featureKey);
    if (!planAllowed) {
      return {
        allowed: false,
        reason: `Feature ${featureKey} is not enabled in plan ${planName}`,
        failedLevel: 'plan',
        planCheck: {
          featureKey,
          enabled: false,
        },
      };
    }
  }

  // Level 2: Profile Security
  if (profileId && objectType) {
    const profileAllowed = await checkProfilePermission(profileId, objectType, action);
    if (!profileAllowed) {
      return {
        allowed: false,
        reason: `Profile does not allow ${action} on ${objectType}`,
        failedLevel: 'profile',
        profileCheck: {
          action,
          objectType,
          allowed: false,
        },
      };
    }
  }

  // Level 3: Object Security
  if (objectType && objectId) {
    const objectAllowed = await checkObjectAccess(
      objectType,
      objectId,
      action,
      currentUserId,
      currentOrgId
    );
    if (!objectAllowed) {
      return {
        allowed: false,
        reason: `User cannot ${action} object ${objectId} of type ${objectType}`,
        failedLevel: 'object',
        objectCheck: {
          objectType,
          objectId,
          action,
          allowed: false,
        },
      };
    }
  }

  // Level 4: Field Security (if field is specified)
  if (profileId && objectType && fieldName && (action === 'read' || action === 'edit')) {
    const fieldAllowed = await checkFieldAccess(
      profileId,
      objectType,
      fieldName,
      action === 'read' ? 'read' : 'edit'
    );
    if (!fieldAllowed) {
      return {
        allowed: false,
        reason: `Profile does not allow ${action} on field ${fieldName} of ${objectType}`,
        failedLevel: 'field',
        fieldCheck: {
          objectType,
          fieldName,
          action: action === 'read' ? 'read' : 'edit',
          allowed: false,
        },
      };
    }
  }

  // All checks passed
  return {
    allowed: true,
    planCheck: featureKey
      ? {
          featureKey,
          enabled: true,
        }
      : undefined,
    profileCheck: profileId && objectType
      ? {
          action,
          objectType,
          allowed: true,
        }
      : undefined,
    objectCheck: objectType && objectId
      ? {
          objectType,
          objectId,
          action,
          allowed: true,
        }
      : undefined,
    fieldCheck: profileId && objectType && fieldName
      ? {
          objectType,
          fieldName,
          action: action === 'read' ? 'read' : 'edit',
          allowed: true,
        }
      : undefined,
  };
}

/**
 * Quick check for feature access (plan + profile)
 */
export async function canAccessFeature(
  planName: PlanName,
  profileId: string | null,
  featureKey: string,
  objectType?: ObjectType
): Promise<boolean> {
  const result = await checkSecurity({
    planName,
    profileId,
    featureKey,
    objectType,
    action: 'read',
  });
  return result.allowed;
}

/**
 * Quick check for object action (all levels)
 */
export async function canPerformAction(
  planName: PlanName,
  profileId: string | null,
  objectType: ObjectType,
  action: Action,
  objectId?: string
): Promise<boolean> {
  const result = await checkSecurity({
    planName,
    profileId,
    objectType,
    objectId,
    action,
  });
  return result.allowed;
}

