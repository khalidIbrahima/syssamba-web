import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { z } from 'zod';

// Schema for updating subscription
const updateSubscriptionSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  status: z.enum(['active', 'trialing', 'past_due', 'canceled', 'unpaid']).optional(),
});

// PATCH - Update organization subscription (change plan)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const isAdmin = await isSuperAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if organization exists
    const organization = await db.selectOne<{ id: string }>('organizations', {
      eq: { id: id },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateSubscriptionSchema.parse(body);

    // Check if plan exists
    const plan = await db.selectOne<{ id: string; name: string }>('plans', {
      eq: { id: validatedData.planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Get current subscription
    const currentSubscriptions = await db.select<{
      id: string;
      status: string;
    }>('subscriptions', {
      eq: { organization_id: id },
      orderBy: { column: 'created_at', ascending: false },
      limit: 1,
    });

    const currentSubscription = currentSubscriptions[0];

    if (currentSubscription) {
      // Update existing subscription
      const updateData: any = {
        plan_id: validatedData.planId,
        updated_at: new Date().toISOString(),
      };

      if (validatedData.status) {
        updateData.status = validatedData.status;
      }

      await db.update('subscriptions', updateData, { id: currentSubscription.id });
    } else {
      // Create new subscription
      await db.insertOne('subscriptions', {
        organization_id: id,
        plan_id: validatedData.planId,
        status: validatedData.status || 'active',
        stripe_subscription_id: null,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      });
    }

    // Get updated subscription
    const updatedSubscriptions = await db.select<{
      id: string;
      plan_id: string;
      status: string;
      created_at: string;
    }>('subscriptions', {
      eq: { organization_id: id },
      orderBy: { column: 'created_at', ascending: false },
      limit: 1,
    });

    const updatedSubscription = updatedSubscriptions[0];

    // Get plan details
    const planDetails = await db.selectOne<{
      id: string;
      name: string;
      display_name: string;
      lots_limit: number | null;
      users_limit: number | null;
      extranet_tenants_limit: number | null;
    }>('plans', {
      eq: { id: updatedSubscription.plan_id },
    });

    return NextResponse.json({
      subscription: {
        id: updatedSubscription.id,
        planId: updatedSubscription.plan_id,
        status: updatedSubscription.status,
        plan: planDetails ? {
          id: planDetails.id,
          name: planDetails.name,
          displayName: planDetails.display_name,
          limits: {
            lots: planDetails.lots_limit,
            users: planDetails.users_limit,
            extranetTenants: planDetails.extranet_tenants_limit,
          },
        } : null,
        createdAt: updatedSubscription.created_at,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

