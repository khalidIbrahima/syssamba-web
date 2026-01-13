import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db';
import { stripe } from '@/lib/stripe-helpers';
import Stripe from 'stripe';
import { headers } from 'next/headers';

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

    // Retrieve the Stripe checkout session (subscription mode)
    const session = await stripe!.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (!session.metadata || !session.metadata.organizationId || session.metadata.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 403 }
      );
    }

    // Verify payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
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

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    // If this is subscription mode, get subscription details from Stripe
    let stripeSubscription: Stripe.Subscription | null = null;
    if (session.mode === 'subscription' && subscriptionId) {
      stripeSubscription = typeof subscriptionId === 'string' 
        ? await stripe!.subscriptions.retrieve(subscriptionId)
        : subscriptionId;
    }

    // Get current subscription from database
    const subscriptions = await db.select<{
      id: string;
      plan_id: string;
      status: string;
    }>('subscriptions', {
      eq: { organization_id: user.organizationId },
      limit: 1,
    });

    const currentSubscription = subscriptions[0];

    // Prepare subscription data
    const subscriptionData: any = {
      plan_id: planId,
      billing_period: billingPeriod,
      price: price,
      status: stripeSubscription 
        ? (stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing' ? 'active' : 'active')
        : 'active',
      stripe_customer_id: customerId,
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date().toISOString(),
    };

    if (stripeSubscription) {
      // Use Stripe subscription data for recurring subscriptions
      subscriptionData.stripe_subscription_id = stripeSubscription.id;
      subscriptionData.current_period_start = new Date(stripeSubscription.current_period_start * 1000).toISOString().split('T')[0];
      subscriptionData.current_period_end = new Date(stripeSubscription.current_period_end * 1000).toISOString().split('T')[0];
      subscriptionData.cancel_at_period_end = stripeSubscription.cancel_at_period_end || false;
      if (stripeSubscription.trial_start) {
        subscriptionData.trial_start = new Date(stripeSubscription.trial_start * 1000).toISOString().split('T')[0];
      }
      if (stripeSubscription.trial_end) {
        subscriptionData.trial_end = new Date(stripeSubscription.trial_end * 1000).toISOString().split('T')[0];
      }
    } else {
      // Fallback for payment mode (shouldn't happen with subscription mode, but keep for compatibility)
      const now = new Date();
      const periodEnd = new Date(now);
      if (billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      subscriptionData.current_period_start = now.toISOString().split('T')[0];
      subscriptionData.current_period_end = periodEnd.toISOString().split('T')[0];
    }

    if (currentSubscription) {
      // Update existing subscription
      await db.update('subscriptions', subscriptionData, { id: currentSubscription.id });
    } else {
      // Create new subscription
      await db.insertOne('subscriptions', {
        ...subscriptionData,
        organization_id: user.organizationId,
        start_date: subscriptionData.current_period_start,
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
