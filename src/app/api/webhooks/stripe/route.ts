import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db';

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2025-11-17.clover',
}) : null;

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 * 
 * Events handled:
 * - checkout.session.completed: When a checkout session is completed (payment or subscription)
 * - customer.subscription.updated: When a subscription is updated
 * - customer.subscription.deleted: When a subscription is canceled
 * - invoice.payment_succeeded: When a recurring payment succeeds
 * - invoice.payment_failed: When a recurring payment fails
 */
export async function POST(request: Request) {
  if (!stripe || !stripeWebhookSecret) {
    console.error('[Stripe Webhook] Stripe is not configured');
    return NextResponse.json(
      { error: 'Stripe webhook not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] No signature found');
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type} (ID: ${event.id})`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed event
 * This is called when a payment is completed (both payment and subscription mode)
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const organizationId = session.metadata?.organizationId;
    const planId = session.metadata?.planId;
    const billingPeriod = session.metadata?.billingPeriod || 'monthly';

    if (!organizationId || !planId) {
      console.error('[Stripe Webhook] Missing organizationId or planId in session metadata');
      return;
    }

    const customerId = session.customer as string;

    // Update organization with customer ID if not already set
    if (customerId) {
      await db.update('organizations', {
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { id: organizationId });
    }

    // If this is a subscription mode checkout, the subscription is already created
    // We just need to update our database
    if (session.mode === 'subscription' && session.subscription) {
      const subscriptionId = session.subscription as string;
      const stripeSubscription = await stripe!.subscriptions.retrieve(subscriptionId);

      // Update or create subscription record
      await updateSubscriptionFromStripe(
        organizationId,
        planId,
        stripeSubscription,
        billingPeriod
      );
    } else if (session.mode === 'payment') {
      // For payment mode, we handle it in the success route
      // But we can still update customer ID here
      console.log('[Stripe Webhook] Payment mode checkout completed, handled by success route');
    }
  } catch (error: any) {
    console.error('[Stripe Webhook] Error handling checkout completed:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    
    // Find organization by customer ID
    const organizations = await db.select<{ id: string }>('organizations', {
      eq: { stripe_customer_id: customerId },
      limit: 1,
    });

    if (organizations.length === 0) {
      console.error(`[Stripe Webhook] Organization not found for customer ${customerId}`);
      return;
    }

    const organizationId = organizations[0].id;

    // Get plan ID from subscription metadata or price
    const planId = subscription.metadata?.planId;
    if (!planId) {
      console.error('[Stripe Webhook] Plan ID not found in subscription metadata');
      return;
    }

    const billingPeriod = subscription.metadata?.billingPeriod || 
      (subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly');

    await updateSubscriptionFromStripe(
      organizationId,
      planId,
      subscription,
      billingPeriod
    );
  } catch (error: any) {
    console.error('[Stripe Webhook] Error handling subscription updated:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    
    // Find organization by customer ID
    const organizations = await db.select<{ id: string }>('organizations', {
      eq: { stripe_customer_id: customerId },
      limit: 1,
    });

    if (organizations.length === 0) {
      console.error(`[Stripe Webhook] Organization not found for customer ${customerId}`);
      return;
    }

    const organizationId = organizations[0].id;

    // Find subscription in database
    const subscriptions = await db.select<{ id: string }>('subscriptions', {
      eq: { organization_id: organizationId, stripe_subscription_id: subscription.id },
      limit: 1,
    });

    if (subscriptions.length > 0) {
      // Update subscription status to canceled
      await db.update('subscriptions', {
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        end_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      }, { id: subscriptions[0].id });
    }
  } catch (error: any) {
    console.error('[Stripe Webhook] Error handling subscription deleted:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded event
 * This is called when a recurring payment succeeds
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) {
      // This is a one-time payment, not a subscription
      return;
    }

    const customerId = invoice.customer as string;
    
    // Find organization by customer ID
    const organizations = await db.select<{ id: string }>('organizations', {
      eq: { stripe_customer_id: customerId },
      limit: 1,
    });

    if (organizations.length === 0) {
      console.error(`[Stripe Webhook] Organization not found for customer ${customerId}`);
      return;
    }

    // Update subscription period dates
    const subscriptions = await db.select<{ id: string }>('subscriptions', {
      eq: { organization_id: organizations[0].id, stripe_subscription_id: subscriptionId },
      limit: 1,
    });

    if (subscriptions.length > 0) {
      const stripeSubscription = await stripe!.subscriptions.retrieve(subscriptionId);
      await db.update('subscriptions', {
        current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString().split('T')[0],
        current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString().split('T')[0],
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { id: subscriptions[0].id });
    }
  } catch (error: any) {
    console.error('[Stripe Webhook] Error handling invoice payment succeeded:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) {
      return;
    }

    const customerId = invoice.customer as string;
    
    // Find organization by customer ID
    const organizations = await db.select<{ id: string }>('organizations', {
      eq: { stripe_customer_id: customerId },
      limit: 1,
    });

    if (organizations.length === 0) {
      console.error(`[Stripe Webhook] Organization not found for customer ${customerId}`);
      return;
    }

    // Update subscription status to past_due
    const subscriptions = await db.select<{ id: string }>('subscriptions', {
      eq: { organization_id: organizations[0].id, stripe_subscription_id: subscriptionId },
      limit: 1,
    });

    if (subscriptions.length > 0) {
      await db.update('subscriptions', {
        status: 'past_due',
        updated_at: new Date().toISOString(),
      }, { id: subscriptions[0].id });
    }
  } catch (error: any) {
    console.error('[Stripe Webhook] Error handling invoice payment failed:', error);
    throw error;
  }
}

/**
 * Update or create subscription record from Stripe subscription object
 */
async function updateSubscriptionFromStripe(
  organizationId: string,
  planId: string,
  stripeSubscription: Stripe.Subscription,
  billingPeriod: string
) {
  try {
    // Get plan price
    const { data: plan } = await supabaseAdmin
      .from('plans')
      .select('price_monthly, price_yearly')
      .eq('id', planId)
      .single();

    let price = plan?.price_monthly || 0;
    if (billingPeriod === 'yearly' && plan?.price_yearly) {
      price = plan.price_yearly;
    }

    // Check if subscription already exists
    const existingSubscriptions = await db.select<{ id: string }>('subscriptions', {
      eq: { organization_id: organizationId },
      limit: 1,
    });

    const subscriptionData = {
      plan_id: planId,
      billing_period: billingPeriod,
      price: price,
      status: stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing' ? 'active' : 
              stripeSubscription.status === 'canceled' ? 'canceled' :
              stripeSubscription.status === 'past_due' ? 'past_due' : 'active',
      stripe_subscription_id: stripeSubscription.id,
      stripe_customer_id: stripeSubscription.customer as string,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString().split('T')[0],
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString().split('T')[0],
      cancel_at_period_end: stripeSubscription.cancel_at_period_end || false,
      canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null,
      trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString().split('T')[0] : null,
      trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString().split('T')[0] : null,
      updated_at: new Date().toISOString(),
    };

    if (existingSubscriptions.length > 0) {
      // Update existing subscription
      await db.update('subscriptions', subscriptionData, { id: existingSubscriptions[0].id });
    } else {
      // Create new subscription
      await db.insertOne('subscriptions', {
        ...subscriptionData,
        organization_id: organizationId,
        start_date: new Date(stripeSubscription.current_period_start * 1000).toISOString().split('T')[0],
        currency: 'XOF',
      });
    }
  } catch (error: any) {
    console.error('[Stripe Webhook] Error updating subscription from Stripe:', error);
    throw error;
  }
}
