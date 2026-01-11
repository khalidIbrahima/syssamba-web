import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db';
import { getPlanLimits } from '@/lib/permissions';
import { z } from 'zod';
import Stripe from 'stripe';

// Initialize Stripe (only if STRIPE_SECRET_KEY is set)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2025-11-17.clover',
}) : null;

// Schema for checkout request
const checkoutSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  billingPeriod: z.enum(['monthly', 'yearly']).optional().default('monthly'),
});

/**
 * POST /api/subscription/checkout
 * Create Stripe Checkout session for plan upgrade
 */
export async function POST(request: Request) {
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

    // Check if user has permission to manage subscription
    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = checkoutSchema.parse(body);

    // Get target plan
    const { data: targetPlan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('id, name, display_name, price_monthly, price_yearly, yearly_discount_rate, max_units, max_users, extranet_tenants_limit, is_active')
      .eq('id', validatedData.planId)
      .single();

    if (planError || !targetPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    if (!targetPlan.is_active) {
      return NextResponse.json(
        { error: 'Plan is not available' },
        { status: 400 }
      );
    }

    // Calculate price based on billing period
    let price = targetPlan.price_monthly || 0;
    if (validatedData.billingPeriod === 'yearly') {
      if (targetPlan.price_yearly) {
        price = targetPlan.price_yearly;
      } else if (targetPlan.yearly_discount_rate) {
        const discountMultiplier = 1 - (targetPlan.yearly_discount_rate / 100);
        price = (targetPlan.price_monthly || 0) * 12 * discountMultiplier;
      } else {
        price = (targetPlan.price_monthly || 0) * 12;
      }
    }

    // For free plans (freemium), no payment needed
    if (price === 0 || targetPlan.price_monthly === 0 || targetPlan.price_monthly === null) {
      return NextResponse.json(
        { error: 'Payment not required for free plans. Use upgrade endpoint directly.' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscriptions = await db.select<{
      id: string;
      plan_id: string;
      status: string;
      billing_period: string;
      stripe_customer_id: string | null;
    }>('subscriptions', {
      eq: { organization_id: user.organizationId },
      limit: 1,
    });

    const currentSubscription = subscriptions[0];

    // Check subscription status
    if (currentSubscription && currentSubscription.status !== 'active' && currentSubscription.status !== 'trialing') {
      return NextResponse.json(
        { 
          error: 'Cannot upgrade: subscription is not active',
          details: `Current status: ${currentSubscription.status}. Please activate your subscription first.`
        },
        { status: 400 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Get or create Stripe customer
    let customerId = currentSubscription?.stripe_customer_id || organization.stripeCustomerId;
    
    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email || organization.contactEmail || undefined,
        name: organization.name || undefined,
        metadata: {
          organizationId: user.organizationId,
          userId: user.id,
        },
      });

      customerId = customer.id;

      // Save customer ID to organization
      await db.update('organizations', {
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { id: user.organizationId });
    }

    // Get base URL
    // In development, use current request URL to preserve domain/subdomain
    // In production, use NEXT_PUBLIC_APP_URL
    const isDevelopment = process.env.NODE_ENV === 'development';
    let baseUrl: string;
    if (isDevelopment) {
      // Use current request URL origin to keep the same domain/subdomain
      try {
        const requestUrl = new URL(request.url);
        baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
      } catch {
        // Fallback if URL parsing fails
        const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/');
        baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      }
    } else {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }

    // Create Stripe Checkout session (payment mode, not subscription)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'xof', // FCFA
            product_data: {
              name: `${targetPlan.display_name} - ${validatedData.billingPeriod === 'yearly' ? 'Annuel' : 'Mensuel'}`,
              description: `Plan ${targetPlan.display_name}`,
            },
            unit_amount: Math.round(price * 100), // Convert to cents (XOF doesn't use decimals, but Stripe expects smallest unit)
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/settings/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/subscription?canceled=true`,
      metadata: {
        organizationId: user.organizationId,
        planId: validatedData.planId,
        billingPeriod: validatedData.billingPeriod,
        upgrade: 'true',
      },
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
