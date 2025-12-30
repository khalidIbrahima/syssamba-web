import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for updating a plan
const updatePlanSchema = z.object({
  id: z.string().uuid('Invalid plan ID'),
  displayName: z.string().min(1, 'Display name is required').optional(),
  description: z.string().nullable().optional(),
  priceMonthly: z.number().nullable().optional(),
  priceYearly: z.number().nullable().optional(),
  priceType: z.enum(['fixed', 'custom']).optional(),
  lotsLimit: z.number().nullable().optional(),
  usersLimit: z.number().nullable().optional(),
  extranetTenantsLimit: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
  popular: z.boolean().optional(),
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

    // Fetch all plans
    const plans = await db.select<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      price_monthly: number | null;
      price_yearly: number | null;
      price_type: 'fixed' | 'custom';
      lots_limit: number | null;
      users_limit: number | null;
      extranet_tenants_limit: number | null;
      is_active: boolean;
      sort_order: number | null;
      created_at: string;
      updated_at: string;
    }>('plans', {
      orderBy: { column: 'sort_order', ascending: true },
    });

    return NextResponse.json({
      plans: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.display_name,
        description: plan.description,
        priceMonthly: plan.price_monthly,
        priceYearly: plan.price_yearly,
        priceType: plan.price_type,
        lotsLimit: plan.lots_limit,
        usersLimit: plan.users_limit,
        extranetTenantsLimit: plan.extranet_tenants_limit,
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

    // Check if plan exists
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
    const updateData: any = {};
    if (updates.displayName !== undefined) {
      updateData.display_name = updates.displayName;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.priceMonthly !== undefined) {
      updateData.price_monthly = updates.priceMonthly;
    }
    if (updates.priceYearly !== undefined) {
      updateData.price_yearly = updates.priceYearly;
    }
    if (updates.priceType !== undefined) {
      updateData.price_type = updates.priceType;
    }
    if (updates.lotsLimit !== undefined) {
      updateData.lots_limit = updates.lotsLimit;
    }
    if (updates.usersLimit !== undefined) {
      updateData.users_limit = updates.usersLimit;
    }
    if (updates.extranetTenantsLimit !== undefined) {
      updateData.extranet_tenants_limit = updates.extranetTenantsLimit;
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

    // Update the plan
    await db.updateOne(
      'plans',
      updateData,
      { id }
    );

    // Fetch updated plan
    const updatedPlan = await db.selectOne<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      price_monthly: number | null;
      price_yearly: number | null;
      price_type: 'fixed' | 'custom';
      lots_limit: number | null;
      users_limit: number | null;
      extranet_tenants_limit: number | null;
      is_active: boolean;
      sort_order: number | null;
    }>('plans', {
      eq: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Plan updated successfully',
      plan: updatedPlan ? {
        id: updatedPlan.id,
        name: updatedPlan.name,
        displayName: updatedPlan.display_name,
        description: updatedPlan.description,
        priceMonthly: updatedPlan.price_monthly,
        priceYearly: updatedPlan.price_yearly,
        priceType: updatedPlan.price_type,
        lotsLimit: updatedPlan.lots_limit,
        usersLimit: updatedPlan.users_limit,
        extranetTenantsLimit: updatedPlan.extranet_tenants_limit,
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

