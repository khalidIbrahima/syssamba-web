/**
 * Functions to read plans from database
 */

import { db } from './db';
import type { PlanDefinition, PlanLimits, PlanFeatures } from './permissions';

// Re-export PlanName type for convenience
export type { PlanName } from './permissions';

/**
 * Get plan from database by name
 */
export async function getPlanFromDB(planName: string): Promise<PlanDefinition | null> {
  try {
    // Supabase returns columns in snake_case
    // Actual schema: price_monthly, max_users, max_properties, max_tenants
    const plan = await db.selectOne<{
      name: string;
      display_name: string;
      description: string | null;
      price_monthly: number | null;
      price_yearly: number | null;
      max_users: number | null;
      max_properties: number | null;
      max_tenants: number | null;
      features: PlanFeatures;
    }>('plans', {
      eq: { name: planName },
    });

    if (!plan) {
      console.warn(`[getPlanFromDB] Plan not found: ${planName}`);
      return null;
    }
    
    // Convert database format to PlanDefinition
    // Use price_monthly as the base price
    const price = plan.price_monthly === null ? 'custom' : plan.price_monthly;
    const features = plan.features as PlanFeatures;

    const planDef: PlanDefinition = {
      name: plan.name,
      display_name: plan.display_name,
      price: price,
      // Map max_properties to lots_limit for compatibility (-1 means unlimited)
      lots_limit: plan.max_properties === -1 ? null : plan.max_properties,
      // Map max_users to users_limit for compatibility
      users_limit: plan.max_users === -1 ? null : plan.max_users,
      // Map max_tenants to extranet_tenants_limit for compatibility
      extranet_tenants_limit: plan.max_tenants === -1 ? null : plan.max_tenants,
      features: features,
    };
    
    console.log(`[getPlanFromDB] Plan: ${planName}, Display name: ${planDef.display_name}, Extranet limit: ${planDef.extranet_tenants_limit}`);
    return planDef;
  } catch (error) {
    console.error('Error fetching plan from database:', error);
    return null;
  }
}

/**
 * Get all active plans from database
 */
export async function getAllPlansFromDB(): Promise<PlanDefinition[]> {
  try {
    // Supabase returns columns in snake_case
    // Actual schema: price_monthly, price_yearly, max_users, max_properties, max_tenants
    const planRecords = await db.select<{
      name: string;
      display_name: string;
      description: string | null;
      price_monthly: number | null;
      price_yearly: number | null;
      max_users: number | null;
      max_properties: number | null;
      max_tenants: number | null;
      features: PlanFeatures;
      sort_order: number | null;
    }>('plans', {
      filter: { is_active: true },
      orderBy: { column: 'sort_order', ascending: true },
    });

    return planRecords.map((plan) => {
      // Use price_monthly as the base price
      // If price_monthly is null or undefined, treat as 'custom'
      const price = plan.price_monthly === null || plan.price_monthly === undefined 
        ? 'custom' 
        : plan.price_monthly;
      
      // Features are now stored in plan_features table, not in plans.features JSONB
      // We'll fetch them separately if needed, but for now return empty object
      // The actual features should be fetched using getPlanFeatures() from plan-features.ts
      const features = {} as PlanFeatures;

      return {
        name: plan.name,
        display_name: plan.display_name,
        price: price,
        // Map max_properties to lots_limit for compatibility
        lots_limit: plan.max_properties === -1 ? null : plan.max_properties,
        // Map max_users to users_limit for compatibility
        users_limit: plan.max_users === -1 ? null : plan.max_users,
        // Map max_tenants to extranet_tenants_limit for compatibility
        extranet_tenants_limit: plan.max_tenants === -1 ? null : plan.max_tenants,
        features: features,
      };
    });
  } catch (error) {
    console.error('Error fetching plans from database:', error);
    return [];
  }
}

/**
 * Get plan limits from database
 */
export async function getPlanLimitsFromDB(planName: string): Promise<PlanLimits> {
  try {
    const plan = await getPlanFromDB(planName);
    
    if (!plan) {
      console.warn(`[getPlanLimitsFromDB] Plan not found: ${planName}, using defaults`);
      // Fallback to default limits
      return {
        lots: 5,
        users: 1,
        extranetTenants: 5,
      };
    }

    const limits: PlanLimits = {
      lots: plan.lots_limit === null || plan.lots_limit === undefined ? -1 : plan.lots_limit,
      users: plan.users_limit === null || plan.users_limit === undefined ? -1 : plan.users_limit,
      extranetTenants: plan.extranet_tenants_limit === null || plan.extranet_tenants_limit === undefined ? -1 : plan.extranet_tenants_limit,
    };
    
    // Note: -1 means unlimited in the PlanLimits interface
    
    console.log(`[getPlanLimitsFromDB] Plan: ${planName}, Limits:`, limits);
    return limits;
  } catch (error) {
    console.error('[getPlanLimitsFromDB] Error:', error);
    // Fallback to default limits on error
    return {
      lots: 5,
      users: 1,
      extranetTenants: 5,
    };
  }
}

/**
 * Check if plan has a specific feature
 */
export async function canAccessFeatureFromDB(
  planName: string,
  feature: keyof PlanFeatures
): Promise<boolean> {
  const plan = await getPlanFromDB(planName);
  
  if (!plan) {
    return false;
  }

  return plan.features[feature] === true;
}

