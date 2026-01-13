import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db } from '@/lib/db';
import { getPlanById, updatePlan as updatePlanDirect } from '@/lib/postgres-db';
import { z } from 'zod';

// Validation schema for creating a plan
const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name (key) is required').regex(/^[a-z0-9_]+$/, 'Plan name must be lowercase alphanumeric with underscores only'),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().nullable().optional(),
  priceMonthly: z.number().nullable().optional(),
  priceYearly: z.number().nullable().optional(),
  yearlyDiscountRate: z.number().min(0).max(100).nullable().optional(), // Taux de remise en % (0-100)
  maxProperties: z.number().nullable().optional(),
  lotsLimit: z.number().nullable().optional(),
  usersLimit: z.number().nullable().optional(),
  extranetTenantsLimit: z.number().nullable().optional(),
  features: z.record(z.string(), z.any()).default({}),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

// Validation schema for updating a plan
const updatePlanSchema = z.object({
  id: z.string().uuid('Invalid plan ID'),
  displayName: z.string().min(1, 'Display name is required').optional(),
  description: z.string().nullable().optional(),
  priceMonthly: z.number().nullable().optional(),
  priceYearly: z.number().nullable().optional(),
  yearlyDiscountRate: z.number().min(0).max(100).nullable().optional(), // Taux de remise en % (0-100)
  maxProperties: z.number().nullable().optional(),
  lotsLimit: z.number().nullable().optional(),
  usersLimit: z.number().nullable().optional(),
  extranetTenantsLimit: z.number().nullable().optional(),
  features: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

/**
 * GET /api/admin/plans
 * Get all plans for admin management
 */
export async function GET() {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    // Fetch all plans using Supabase client (more reliable than direct PostgreSQL)
    const plansFromSupabase = await db.select<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      price_monthly: number | null;
      price_yearly: number | null;
      yearly_discount_rate: number | null;
      max_properties: number | null;
      lots_limit: number | null;
      users_limit: number | null;
      extranet_tenants_limit: number | null;
      features: any;
      is_active: boolean;
      sort_order: number | null;
      created_at: string;
      updated_at: string;
    }>('plans', {
      orderBy: { column: 'sort_order', ascending: true },
    });

    const plans = plansFromSupabase.map(plan => {
      // Calculate yearly price if yearly_discount_rate is set and yearly price is not already set
      let yearlyPrice = plan.price_yearly;
      
      if (plan.yearly_discount_rate !== null && plan.yearly_discount_rate !== undefined) {
        if (plan.price_monthly !== null && plan.price_monthly !== undefined && plan.price_monthly > 0) {
          // Formula: yearly_price = monthly_price * 12 * (1 - discount_rate/100)
          const discountMultiplier = 1 - (plan.yearly_discount_rate / 100);
          yearlyPrice = plan.price_monthly * 12 * discountMultiplier;
        }
      }
      
      return {
        id: plan.id,
        name: plan.name,
        display_name: plan.display_name,
        description: plan.description,
        price_monthly: plan.price_monthly,
        price_yearly: yearlyPrice,
        yearly_discount_rate: plan.yearly_discount_rate,
        max_properties: plan.max_properties,
        lots_limit: plan.lots_limit, // Keep lots_limit as separate field
        users_limit: plan.users_limit,
        extranet_tenants_limit: plan.extranet_tenants_limit,
        features: plan.features || {},
        is_active: plan.is_active,
        sort_order: plan.sort_order,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
      };
    });

    return NextResponse.json({
      plans: plans.map((plan: any) => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.display_name,
        description: plan.description,
        priceMonthly: plan.price_monthly ? parseFloat(plan.price_monthly) : null,
        priceYearly: plan.price_yearly ? parseFloat(plan.price_yearly) : null,
        yearlyDiscountRate: plan.yearly_discount_rate ? parseFloat(plan.yearly_discount_rate) : null,
        maxProperties: plan.max_properties,
        lotsLimit: plan.lots_limit,
        usersLimit: plan.users_limit,
        extranetTenantsLimit: plan.extranet_tenants_limit,
        features: typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {}),
        isActive: plan.is_active,
        sortOrder: plan.sort_order,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      })),
      count: plans.length,
    });

  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/plans
 * Update a specific plan
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updatePlanSchema.parse(body);

    const { id, ...updates } = validatedData;

    // Check if plan exists using Supabase client
    const existingPlan = await db.selectOne<{ id: string }>('plans', {
      eq: { id },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    // Map to actual database column names (max_properties, lots_limit, users_limit)
    const updateData: {
      display_name?: string;
      description?: string | null;
      price_monthly?: number | null;
      price_yearly?: number | null;
      yearly_discount_rate?: number | null;
      max_properties?: number | null;
      lots_limit?: number | null;
      users_limit?: number | null;
      extranet_tenants_limit?: number | null;
      features?: any;
      is_active?: boolean;
      sort_order?: number | null;
    } = {};

    if (updates.displayName !== undefined) {
      updateData.display_name = updates.displayName;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.priceMonthly !== undefined) {
      updateData.price_monthly = updates.priceMonthly;
    }
    
    // Handle yearly_discount_rate
    if (updates.yearlyDiscountRate !== undefined) {
      updateData.yearly_discount_rate = updates.yearlyDiscountRate;
      
      // If yearly_discount_rate is set and priceMonthly exists, calculate price_yearly automatically
      // unless priceYearly is explicitly provided
      if (updates.yearlyDiscountRate !== null && updates.yearlyDiscountRate !== undefined) {
        const currentPlan = await db.selectOne<{ price_monthly: number | null }>('plans', {
          eq: { id },
        });
        const monthlyPrice = updates.priceMonthly !== undefined ? updates.priceMonthly : currentPlan?.price_monthly;
        
        if (monthlyPrice !== null && monthlyPrice !== undefined && monthlyPrice > 0 && updates.priceYearly === undefined) {
          // Formula: yearly_price = monthly_price * 12 * (1 - discount_rate/100)
          const discountMultiplier = 1 - (updates.yearlyDiscountRate / 100);
          updateData.price_yearly = monthlyPrice * 12 * discountMultiplier;
        }
      }
    }
    
    if (updates.priceYearly !== undefined) {
      updateData.price_yearly = updates.priceYearly;
    }
    // Handle maxProperties
    if (updates.maxProperties !== undefined) {
      updateData.max_properties = updates.maxProperties;
    }
    // Map lotsLimit to lots_limit (for backward compatibility)
    if (updates.lotsLimit !== undefined) {
      updateData.lots_limit = updates.lotsLimit;
    }
    // Map usersLimit to users_limit (actual column name)
    if (updates.usersLimit !== undefined) {
      updateData.users_limit = updates.usersLimit;
    }
    if (updates.extranetTenantsLimit !== undefined) {
      updateData.extranet_tenants_limit = updates.extranetTenantsLimit;
    }
    if (updates.features !== undefined) {
      updateData.features = updates.features;
    }
    if (updates.isActive !== undefined) {
      updateData.is_active = updates.isActive;
    }
    if (updates.sortOrder !== undefined) {
      updateData.sort_order = updates.sortOrder;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Update the plan using Supabase client (more reliable)
    try {
      await db.updateOne('plans', updateData, { id });
    } catch (updateError) {
      console.error('Error updating plan in database:', updateError);
      throw updateError;
    }

    // Fetch updated plan
    let updatedPlan;
    try {
      updatedPlan = await db.selectOne<{
        id: string;
        name: string;
        display_name: string;
        description: string | null;
        price_monthly: number | null;
        price_yearly: number | null;
        yearly_discount_rate: number | null;
        max_properties: number | null;
        lots_limit: number | null;
        users_limit: number | null;
        extranet_tenants_limit: number | null;
        features: any;
        is_active: boolean;
        sort_order: number | null;
      }>('plans', {
        eq: { id },
      });
    } catch (fetchError) {
      console.error('Error fetching updated plan:', fetchError);
      throw fetchError;
    }

    // Calculate yearly price if yearly_discount_rate is set
    let calculatedYearlyPrice = updatedPlan?.price_yearly ?? null;
    if (updatedPlan && updatedPlan.yearly_discount_rate !== null && updatedPlan.yearly_discount_rate !== undefined) {
      if (updatedPlan.price_monthly !== null && updatedPlan.price_monthly !== undefined && updatedPlan.price_monthly > 0) {
        const discountMultiplier = 1 - (updatedPlan.yearly_discount_rate / 100);
        calculatedYearlyPrice = updatedPlan.price_monthly * 12 * discountMultiplier;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Plan updated successfully',
      plan: updatedPlan ? {
        id: updatedPlan.id,
        name: updatedPlan.name,
        displayName: updatedPlan.display_name,
        description: updatedPlan.description,
        priceMonthly: updatedPlan.price_monthly ? parseFloat(String(updatedPlan.price_monthly)) : null,
        priceYearly: calculatedYearlyPrice ? parseFloat(String(calculatedYearlyPrice)) : null,
        yearlyDiscountRate: updatedPlan.yearly_discount_rate ? parseFloat(String(updatedPlan.yearly_discount_rate)) : null,
        maxProperties: updatedPlan.max_properties,
        lotsLimit: updatedPlan.lots_limit || updatedPlan.max_properties, // Use lots_limit if available, otherwise max_properties for backward compatibility
        usersLimit: updatedPlan.users_limit,
        extranetTenantsLimit: updatedPlan.extranet_tenants_limit,
        features: typeof updatedPlan.features === 'string' ? JSON.parse(updatedPlan.features) : (updatedPlan.features || {}),
        isActive: updatedPlan.is_active,
        sortOrder: updatedPlan.sort_order,
      } : null,
    });

  } catch (error) {
    console.error('Error updating plan:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/plans
 * Create a new plan
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createPlanSchema.parse(body);

    // Check if plan name already exists
    const existingPlan = await db.selectOne<{ id: string }>('plans', {
      eq: { name: validatedData.name },
    });

    if (existingPlan) {
      return NextResponse.json(
        { error: 'Plan with this name already exists' },
        { status: 400 }
      );
    }

    // Calculate yearly price if yearly_discount_rate is set and priceYearly is not provided
    let calculatedYearlyPrice = validatedData.priceYearly ?? null;
    if (validatedData.yearlyDiscountRate !== null && validatedData.yearlyDiscountRate !== undefined) {
      if (validatedData.priceMonthly !== null && validatedData.priceMonthly !== undefined && validatedData.priceMonthly > 0) {
        // Formula: yearly_price = monthly_price * 12 * (1 - discount_rate/100)
        const discountMultiplier = 1 - (validatedData.yearlyDiscountRate / 100);
        calculatedYearlyPrice = validatedData.priceMonthly * 12 * discountMultiplier;
      }
    }

    // Build insert data with actual database column names
    const insertData = {
      name: validatedData.name,
      display_name: validatedData.displayName,
      description: validatedData.description || null,
      price_monthly: validatedData.priceMonthly ?? null,
      price_yearly: calculatedYearlyPrice,
      yearly_discount_rate: validatedData.yearlyDiscountRate ?? null,
      max_properties: validatedData.maxProperties ?? null,
      lots_limit: validatedData.lotsLimit ?? null,
      users_limit: validatedData.usersLimit ?? null,
      extranet_tenants_limit: validatedData.extranetTenantsLimit ?? null,
      features: validatedData.features || {},
      is_active: validatedData.isActive ?? true,
      sort_order: validatedData.sortOrder ?? 0,
    };

    // Create the plan
    const newPlan = await db.insertOne<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      price_monthly: number | null;
      price_yearly: number | null;
      yearly_discount_rate: number | null;
      max_properties: number | null;
      lots_limit: number | null;
      users_limit: number | null;
      extranet_tenants_limit: number | null;
      features: any;
      is_active: boolean;
      sort_order: number | null;
      created_at: string;
      updated_at: string;
    }>('plans', insertData);

    if (!newPlan) {
      return NextResponse.json(
        { error: 'Failed to create plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Plan created successfully',
      plan: {
        id: newPlan.id,
        name: newPlan.name,
        displayName: newPlan.display_name,
        description: newPlan.description,
        priceMonthly: newPlan.price_monthly ? parseFloat(String(newPlan.price_monthly)) : null,
        priceYearly: newPlan.price_yearly ? parseFloat(String(newPlan.price_yearly)) : null,
        yearlyDiscountRate: newPlan.yearly_discount_rate ? parseFloat(String(newPlan.yearly_discount_rate)) : null,
        maxProperties: newPlan.max_properties,
        lotsLimit: newPlan.lots_limit || newPlan.max_properties, // Use lots_limit if available, otherwise max_properties
        usersLimit: newPlan.users_limit,
        extranetTenantsLimit: newPlan.extranet_tenants_limit,
        features: typeof newPlan.features === 'string' ? JSON.parse(newPlan.features) : (newPlan.features || {}),
        isActive: newPlan.is_active,
        sortOrder: newPlan.sort_order,
      },
    });

  } catch (error) {
    console.error('Error creating plan:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
