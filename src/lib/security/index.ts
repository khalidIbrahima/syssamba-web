/**
 * Security System - Hierarchical Access Control
 * 
 * 4 Levels of Security:
 * 1. Plan Features Security - What features are available based on subscription plan
 * 2. Profile Security - What actions user can perform based on their profile
 * 3. Object Security - What objects user can access (OLS - Object Level Security)
 * 4. Field Security - What fields user can see/edit (FLS - Field Level Security) [Future]
 * 
 * Security checks are hierarchical:
 * - Plan must allow the feature
 * - Profile must allow the action
 * - Object permissions must allow access
 * - Field permissions must allow field access (future)
 */

export type SecurityLevel = 'plan' | 'profile' | 'object' | 'field';
export type Action = 'read' | 'create' | 'edit' | 'delete' | 'viewAll';

export interface SecurityContext {
  planName: string;
  profileId: string | null;
  userId: string;
  organizationId: string | null;
}

export interface PlanFeatureCheck {
  featureKey: string;
  enabled: boolean;
}

export interface ProfilePermissionCheck {
  action: Action;
  objectType?: string;
  allowed: boolean;
}

export interface ObjectPermissionCheck {
  objectType: string;
  objectId?: string;
  action: Action;
  allowed: boolean;
}

export interface FieldPermissionCheck {
  objectType: string;
  fieldName: string;
  action: 'read' | 'edit';
  allowed: boolean;
}

/**
 * Combined security check result
 */
export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  failedLevel?: SecurityLevel;
  planCheck?: PlanFeatureCheck;
  profileCheck?: ProfilePermissionCheck;
  objectCheck?: ObjectPermissionCheck;
  fieldCheck?: FieldPermissionCheck;
}

// Re-export all security functions
export * from './plan-security';
export * from './profile-security';
export * from './object-security';
export * from './field-security';
export * from './security-checker';
export * from './visibility-helper';
export * from './profile-access-level';
export * from './profile-permissions-reader';
