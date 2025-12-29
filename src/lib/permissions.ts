// Permissions and limits configuration for SAMBA SYS
// All plan data is read from the database

import { getPlanFromDB, getPlanLimitsFromDB } from './plans-db';
import { getEnabledPlanFeatures } from './plan-features';

export type PlanName = 'freemium' | 'starter' | 'pro' | 'agency' | 'enterprise';

export type SupportLevel = 'community' | 'email' | 'priority_email' | 'phone_24_7' | 'dedicated_manager';

export type ExtranetTenantType = 'limited' | 'unlimited';

// Dynamic PlanFeatures interface - features are read from database
export interface PlanFeatures {
  [featureKey: string]: boolean | string | undefined;
}

export interface PlanDefinition {
  name: string;
  display_name?: string; // Display name from database
  price: number | 'custom';
  lots_limit: number | null;
  users_limit: number | null;
  extranet_tenants_limit: number | null;
  features: PlanFeatures;
}

export interface PlanLimits {
  lots: number; // -1 for unlimited
  users: number; // -1 for unlimited
  extranetTenants: number; // -1 for unlimited
}

// All plan data is now read from the database
// These functions are async and fetch data from the database

// Helper function to get plan limits (async, reads from database)
export async function getPlanLimits(plan: PlanName): Promise<PlanLimits> {
  return await getPlanLimitsFromDB(plan);
}

// Helper function to get plan definition (async, reads from database)
export async function getPlanDefinition(plan: PlanName): Promise<PlanDefinition> {
  const planDef = await getPlanFromDB(plan);
  if (!planDef) {
    // Fallback to freemium if plan not found
    const fallback = await getPlanFromDB('freemium');
    return fallback || {
      name: 'freemium',
      price: 0,
      lots_limit: 5,
      users_limit: 1,
      extranet_tenants_limit: 5,
      features: {} as PlanFeatures,
    };
  }
  return planDef;
}

// Feature access check function (async, reads from database)
// Uses plan_features table to check if feature is enabled
export async function canAccessFeature(plan: PlanName, feature: keyof PlanFeatures): Promise<boolean> {
  try {
    // First try using plan_features table (more reliable)
    const enabledFeatures = await getEnabledPlanFeatures(plan);
    if (enabledFeatures.has(feature as string)) {
      return true;
    }
    
    // Fallback to checking plan definition features JSONB
    const planDef = await getPlanFromDB(plan);
    if (!planDef) return false;
    
    return planDef.features[feature] === true;
  } catch (error) {
    console.error('Error checking feature access:', error);
    return false;
  }
}

// Legacy function for backward compatibility (async, reads from database)
// Feature mappings are now read from the database via API
export async function canAccess(feature: string, plan: string): Promise<boolean> {
  const planName = plan as PlanName;

  try {
    // Fetch feature mappings from API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/features`);
    if (!response.ok) {
      console.error('Failed to fetch feature mappings');
      return false;
    }

    const data = await response.json();
    const legacyMappings = data.mappings?.legacyMappings || {};

    // Map legacy feature name to current feature key
    const featureKey = legacyMappings[feature] || feature;

    return await canAccessFeature(planName, featureKey);
  } catch (error) {
    console.error('Error in canAccess function:', error);
    return false;
  }
}

// Check if limit is exceeded
export function isLimitExceeded(currentCount: number, limit: number): boolean {
  if (limit === -1) return false; // unlimited
  return currentCount >= limit;
}

// Check if extranet tenant limit is exceeded (async, reads from database)
export async function isExtranetLimitExceeded(
  currentCount: number,
  plan: PlanName
): Promise<boolean> {
  const limits = await getPlanLimits(plan);
  return isLimitExceeded(currentCount, limits.extranetTenants);
}

// Check if lots limit is exceeded (async, reads from database)
export async function isLotsLimitExceeded(
  currentCount: number,
  plan: PlanName
): Promise<boolean> {
  const limits = await getPlanLimits(plan);
  return isLimitExceeded(currentCount, limits.lots);
}

// Check if users limit is exceeded (async, reads from database)
export async function isUsersLimitExceeded(
  currentCount: number,
  plan: PlanName
): Promise<boolean> {
  const limits = await getPlanLimits(plan);
  return isLimitExceeded(currentCount, limits.users);
}

// Get support level for plan (async, reads from database)
export async function getSupportLevel(plan: PlanName): Promise<SupportLevel> {
  const planDef = await getPlanFromDB(plan);
  const supportLevel = planDef?.features.support as SupportLevel;
  return supportLevel || 'community';
}

// Check if plan has unlimited extranet tenants (async, reads from database)
export async function hasUnlimitedExtranet(plan: PlanName): Promise<boolean> {
  const planDef = await getPlanFromDB(plan);
  return planDef?.features.extranet_tenant === 'unlimited';
}

// Check if plan supports custom domain (async, reads from database)
export async function supportsCustomDomain(plan: PlanName): Promise<boolean> {
  return await canAccessFeature(plan, 'custom_extranet_domain');
}

// Check if plan supports white label (async, reads from database)
export async function supportsWhiteLabel(plan: PlanName): Promise<boolean> {
  return await canAccessFeature(plan, 'white_label_option') || 
         await canAccessFeature(plan, 'full_white_label');
}
