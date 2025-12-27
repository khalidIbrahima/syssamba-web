// Permissions and limits configuration for SAMBA SYS
// All plan data is read from the database

import { getPlanFromDB, getPlanLimitsFromDB } from './plans-db';
import { getEnabledPlanFeatures } from './plan-features';

export type PlanName = 'freemium' | 'starter' | 'pro' | 'agency' | 'enterprise';

export type SupportLevel = 'community' | 'email' | 'priority_email' | 'phone_24_7' | 'dedicated_manager';

export type ExtranetTenantType = 'limited' | 'unlimited';

export interface PlanFeatures {
  // Core features
  dashboard: boolean;
  properties_management: boolean;
  units_management: boolean;
  
  // Tenants
  tenants_basic?: boolean;
  tenants_full?: boolean;
  
  // Leases
  leases_basic?: boolean;
  leases_full?: boolean;
  
  // Payments
  payments_manual_entry?: boolean;
  payments_all_methods?: boolean;
  receipt_generation: boolean;
  wave_orange_payment_link: boolean;
  
  // Tasks
  basic_tasks?: boolean;
  tasks_full?: boolean;
  
  // Notifications
  email_notifications: boolean;
  sms_notifications: boolean;
  
  // Extranet
  extranet_tenant: ExtranetTenantType;
  custom_extranet_domain: boolean;
  full_white_label?: boolean;
  white_label_option?: boolean;
  
  // Accounting
  accounting_sycoda_basic?: boolean;
  accounting_sycoda_full?: boolean;
  dsf_export: boolean;
  bank_sync: boolean;
  
  // Advanced features
  electronic_signature: boolean;
  mobile_offline_edl: boolean;
  reports_basic?: boolean;
  reports_advanced?: boolean;
  copropriete_module?: boolean;
  marketplace_services?: boolean;
  api_access?: boolean;
  dedicated_support?: boolean;
  on_premise_option?: boolean;
  
  // Support
  support: SupportLevel;
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
export async function canAccess(feature: string, plan: string): Promise<boolean> {
  const planName = plan as PlanName;

  // Map legacy feature names to new feature keys
  const featureMap: Record<string, keyof PlanFeatures> = {
    'properties': 'properties_management',
    'properties_management': 'properties_management',
    'units': 'units_management',
    'units_management': 'units_management',
    'tenants': 'tenants_full',
    'tenants_basic': 'tenants_basic',
    'tenants_full': 'tenants_full',
    'leases': 'leases_full',
    'leases_basic': 'leases_basic',
    'leases_full': 'leases_full',
    'payments': 'payments_all_methods',
    'payments_manual_entry': 'payments_manual_entry',
    'payments_all_methods': 'payments_all_methods',
    'accounting': 'accounting_sycoda_full',
    'accounting_basic': 'accounting_sycoda_basic',
    'accounting_full': 'accounting_sycoda_full',
    'tasks': 'tasks_full',
    'basic_tasks': 'basic_tasks',
    'tasks_full': 'tasks_full',
    'notifications': 'email_notifications',
    'email_notifications': 'email_notifications',
    'sms_notifications': 'sms_notifications',
    'extranet': 'extranet_tenant',
    'custom_domain': 'custom_extranet_domain',
    'white_label': 'white_label_option',
    'full_white_label': 'full_white_label',
    'dsf_export': 'dsf_export',
    'bank_sync': 'bank_sync',
    'electronic_signature': 'electronic_signature',
    'mobile_offline_edl': 'mobile_offline_edl',
    'wave_orange_payment_link': 'wave_orange_payment_link',
    'reports_basic': 'reports_basic',
    'reports_advanced': 'reports_advanced',
    'copropriete_module': 'copropriete_module',
    'marketplace_services': 'marketplace_services',
    'api_access': 'api_access',
    'priority_support': 'dedicated_support',
  };

  const featureKey = featureMap[feature] || feature as keyof PlanFeatures;
  return await canAccessFeature(planName, featureKey);
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
  return planDef?.features.support || 'community';
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
