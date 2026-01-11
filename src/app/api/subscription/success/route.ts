import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db';
import Stripe from 'stripe';
import { headers } from 'next/headers';

// Initialize Stripe (only if STRIPE_SECRET_KEY is set)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2024-11-20.acacia',
}) : null;

/**
 * GET /api/subscription/success
 * Handle successful payment and finalize upgrade
 * This is called after Stripe Checkout redirects back
 */
export async function GET(request: Request) {
  try {
    const { userId } = await checkAuth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    // Retrieve the Stripe checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (!session.metadata || !session.metadata.organizationId || session.metadata.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 403 }
      );
    }

    const planId = session.metadata.planId;
    const billingPeriod = session.metadata.billingPeriod || 'monthly';

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID not found in session' },
        { status: 400 }
      );
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('id, name, display_name, price_monthly, price_yearly, yearly_discount_rate')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Calculate price
    let price = plan.price_monthly || 0;
    if (billingPeriod === 'yearly') {
      if (plan.price_yearly) {
        price = plan.price_yearly;
      } else if (plan.yearly_discount_rate) {
        const discountMultiplier = 1 - (plan.yearly_discount_rate / 100);
        price = (plan.price_monthly || 0) * 12 * discountMultiplier;
      } else {
        price = (plan.price_monthly || 0) * 12;
      }
    }

    // Get current subscription
    const subscriptions = await db.select<{
      id: string;
      plan_id: string;
      status: string;
    }>('subscriptions', {
      eq: { organization_id: user.organizationId },
      limit: 1,
    });

    const currentSubscription = subscriptions[0];

    // Update or create subscription
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingPeriod === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    if (currentSubscription) {
      // Update existing subscription
      await db.update('subscriptions', {
        plan_id: planId,
        billing_period: billingPeriod,
        price: price,
        status: 'active',
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        current_period_start: now.toISOString().split('T')[0],
        current_period_end: periodEnd.toISOString().split('T')[0],
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: new Date().toISOString(),
      }, { id: currentSubscription.id });
    } else {
      // Create new subscription
      await db.insertOne('subscriptions', {
        organization_id: user.organizationId,
        plan_id: planId,
        billing_period: billingPeriod,
        price: price,
        status: 'active',
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        start_date: now.toISOString().split('T')[0],
        current_period_start: now.toISOString().split('T')[0],
        current_period_end: periodEnd.toISOString().split('T')[0],
        currency: 'XOF',
      });
    }

    // Update organization stripe customer ID if needed
    if (customerId) {
      await db.update('organizations', {
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { id: user.organizationId });
    }

    return NextResponse.json({
      success: true,
      message: `Plan mis à niveau vers ${plan.display_name} avec succès!`,
      subscription: {
        planId: planId,
        planName: plan.name,
        planDisplayName: plan.display_name,
        billingPeriod,
        price,
      },
    });

  } catch (error: any) {
    console.error('Error finalizing upgrade:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to finalize upgrade' },
      { status: 500 }
    );
  }
}
