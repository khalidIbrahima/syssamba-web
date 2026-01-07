import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db';

/**
 * GET /api/subscription/billing
 * Get current user's organization subscription, plan details, and usage information
 */
export async function GET() {
  try {
    const { userId } = await checkAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.organizationId) {
      // No organization, return freemium plan data
      const { data: freemiumPlan } = await supabaseAdmin
        .from('plans')
        .select('id, name, display_name, price_monthly, max_units, max_users, extranet_tenants_limit')
        .eq('name', 'freemium')
        .eq('is_active', true)
        .single();

      if (freemiumPlan) {
        return NextResponse.json({
          subscription: {
            planName: freemiumPlan.name,
            planDisplayName: freemiumPlan.display_name || freemiumPlan.name,
            planId: freemiumPlan.id,
            price: freemiumPlan.price_monthly || 0,
            billingPeriod: 'monthly',
            status: 'active',
            limits: {
              lots: freemiumPlan.max_units === -1 ? -1 : freemiumPlan.max_units,
              users: freemiumPlan.max_users === -1 ? -1 : freemiumPlan.max_users,
              extranetTenants: freemiumPlan.extranet_tenants_limit === -1 ? -1 : freemiumPlan.extranet_tenants_limit,
            },
          },
          usage: {
            lots: 0,
            users: 1, // Current user
            extranetTenants: 0,
          },
          paymentHistory: [],
          paymentMethod: null,
        });
      }
    }

    // Get active subscription for the organization
    const subscriptions = await db.select<{
      id: string;
      plan_id: string;
      status: string;
      billing_period: string;
      price: number;
      current_period_start: string;
      current_period_end: string;
      cancel_at_period_end: boolean;
      trial_start: string | null;
      trial_end: string | null;
    }>('subscriptions', {
      eq: { organization_id: user.organizationId },
      limit: 1,
    });

    const subscription = subscriptions[0];

    // Get plan details directly from Supabase with correct field names
    let planRecord: any = null;
    if (subscription && subscription.plan_id) {
      const { data, error } = await supabaseAdmin
        .from('plans')
        .select('id, name, display_name, price_monthly, price_yearly, max_units, max_users, extranet_tenants_limit, yearly_discount_rate')
        .eq('id', subscription.plan_id)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        planRecord = data;
      }
    }

    // If no subscription or plan, use freemium
    if (!subscription || !planRecord) {
      const { data: freemiumPlan } = await supabaseAdmin
        .from('plans')
        .select('id, name, display_name, price_monthly, max_units, max_users, extranet_tenants_limit')
        .eq('name', 'freemium')
        .eq('is_active', true)
        .single();

      if (freemiumPlan) {
        return NextResponse.json({
          subscription: {
            planName: freemiumPlan.name,
            planDisplayName: freemiumPlan.display_name || freemiumPlan.name,
            planId: freemiumPlan.id,
            price: freemiumPlan.price_monthly || 0,
            billingPeriod: 'monthly',
            status: 'active',
            limits: {
              lots: freemiumPlan.max_units === -1 ? -1 : freemiumPlan.max_units,
              users: freemiumPlan.max_users === -1 ? -1 : freemiumPlan.max_users,
              extranetTenants: freemiumPlan.extranet_tenants_limit === -1 ? -1 : freemiumPlan.extranet_tenants_limit,
            },
          },
          usage: {
            lots: 0,
            users: 0,
            extranetTenants: 0,
          },
          paymentHistory: [],
          paymentMethod: null,
        });
      }
    }

    // Calculate price based on billing period
    let price = planRecord.price_monthly || 0;
    if (subscription.billing_period === 'yearly' && planRecord.price_yearly) {
      price = planRecord.price_yearly;
    } else if (subscription.billing_period === 'yearly' && planRecord.yearly_discount_rate) {
      // Calculate yearly price with discount
      const discountMultiplier = 1 - (planRecord.yearly_discount_rate / 100);
      price = (planRecord.price_monthly || 0) * 12 * discountMultiplier;
    }

    // Get usage data (this could be calculated from actual counts)
    // For now, return zeros - can be enhanced later
    const usage = {
      lots: 0,
      users: 0,
      extranetTenants: 0,
    };

    // Get payment history (placeholder - can be enhanced later)
    const paymentHistory: any[] = [];

    // Get payment method (placeholder - can be enhanced later)
    const paymentMethod = null;

    return NextResponse.json({
      subscription: {
        planName: planRecord.name,
        planDisplayName: planRecord.display_name || planRecord.name,
        planId: planRecord.id,
        price: price,
        billingPeriod: subscription.billing_period || 'monthly',
        status: subscription.status || 'active',
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        trialStart: subscription.trial_start,
        trialEnd: subscription.trial_end,
        limits: {
          lots: planRecord.max_units === -1 ? -1 : planRecord.max_units,
          users: planRecord.max_users === -1 ? -1 : planRecord.max_users,
          extranetTenants: planRecord.extranet_tenants_limit === -1 ? -1 : planRecord.extranet_tenants_limit,
        },
      },
      usage,
      paymentHistory,
      paymentMethod,
    });
  } catch (error) {
    console.error('Error fetching billing information:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

