import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { z } from 'zod';

// Payment result interface
interface PaymentResult {
  success: boolean;
  transactionId?: string;
  status: 'completed' | 'pending' | 'failed';
  message: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  gatewayResponse?: Record<string, any>;
  failureReason?: string;
}

// Validation schema for payment data
const paymentSchema = z.object({
  planId: z.string().uuid('L\'ID du plan est requis et doit être un UUID valide'),
  billingPeriod: z.enum(['monthly', 'yearly']),
  paymentMethod: z.enum(['stripe', 'paypal', 'wave', 'orange_money']),
  // Optional payment provider specific data
  paymentData: z.record(z.string(), z.any()).optional(),
});

/**
 * POST /api/organization/payment
 * Process payment for organization setup
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
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'User or organization not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = paymentSchema.parse(body);

    // Check if payment should be skipped (dev mode)
    const skipPayment = process.env.SKIP_PAYMENT_IN_DEV === 'true' && process.env.NODE_ENV === 'development';

    if (skipPayment) {
      console.log('[Payment] Skipping payment in dev mode');
      // Get plan details by ID
      const plan = await db.selectOne<{
        id: string;
        name: string;
        price_monthly: number | null;
        price_yearly: number | null;
      }>('plans', {
        eq: { id: validatedData.planId },
      });

      if (!plan || !plan.id) {
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        );
      }

      // Calculate price
      const price = validatedData.billingPeriod === 'yearly' 
        ? (plan.price_yearly || (plan.price_monthly ? plan.price_monthly * 12 * 0.8 : 0))
        : (plan.price_monthly || 0);

      // Calculate period dates
      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      
      let periodEnd: Date;
      if (validatedData.billingPeriod === 'yearly') {
        periodEnd = new Date(now);
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      const periodEndDate = periodEnd.toISOString().split('T')[0];

      // Create or update subscription
      const existingSubscriptions = await db.select<{
        id: string;
      }>('subscriptions', {
        eq: { organization_id: user.organizationId },
        limit: 1,
      });

      let subscriptionId: string;
      if (existingSubscriptions.length === 0) {
        const newSubscription = await db.insertOne<{ id: string }>('subscriptions', {
          organization_id: user.organizationId,
          plan_id: plan.id,
          billing_period: validatedData.billingPeriod,
          price: price,
          currency: 'XOF',
          status: 'active', // Active in dev mode
          start_date: startDate,
          current_period_start: startDate,
          current_period_end: periodEndDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (!newSubscription || !newSubscription.id) {
          return NextResponse.json(
            { error: 'Failed to create subscription' },
            { status: 500 }
          );
        }
        subscriptionId = newSubscription.id;
      } else {
        subscriptionId = existingSubscriptions[0].id;
        await db.update('subscriptions', {
          plan_id: plan.id,
          billing_period: validatedData.billingPeriod,
          price: price,
          status: 'active',
          current_period_start: startDate,
          current_period_end: periodEndDate,
          updated_at: new Date().toISOString(),
        }, {
          eq: { id: subscriptionId },
        });
      }

      // Create subscription payment record for dev mode
      await db.insertOne('subscription_payments', {
        subscription_id: subscriptionId,
        organization_id: user.organizationId,
        amount: price,
        currency: 'XOF',
        payment_method: validatedData.paymentMethod,
        billing_period_start: startDate,
        billing_period_end: periodEndDate,
        status: 'completed',
        transaction_id: `dev_${Date.now()}`,
        gateway_response: { dev_mode: true, skipped: true },
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: 'Payment skipped in dev mode',
        subscription: {
          status: 'active',
        },
      });
    }

    // Get plan details by ID first (needed for payment processing)
    const plan = await db.selectOne<{
      id: string;
      name: string;
      price_monthly: number | null;
      price_yearly: number | null;
    }>('plans', {
      eq: { id: validatedData.planId },
    });

    if (!plan || !plan.id) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Process actual payment based on payment method
    let paymentResult: PaymentResult;

    switch (validatedData.paymentMethod) {
      case 'stripe':
        paymentResult = await processStripePayment({
          planName: plan.name,
          billingPeriod: validatedData.billingPeriod,
          organizationId: user.organizationId,
          paymentData: validatedData.paymentData,
        });
        break;

      case 'paypal':
        paymentResult = await processPayPalPayment({
          planName: plan.name,
          billingPeriod: validatedData.billingPeriod,
          organizationId: user.organizationId,
          paymentData: validatedData.paymentData,
        });
        break;

      case 'wave':
        paymentResult = await processWavePayment({
          planName: plan.name,
          billingPeriod: validatedData.billingPeriod,
          organizationId: user.organizationId,
          paymentData: validatedData.paymentData,
        });
        break;

      case 'orange_money':
        paymentResult = await processOrangeMoneyPayment({
          planName: plan.name,
          billingPeriod: validatedData.billingPeriod,
          organizationId: user.organizationId,
          paymentData: validatedData.paymentData,
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid payment method' },
          { status: 400 }
        );
    }

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.message || 'Payment failed' },
        { status: 400 }
      );
    }

    if (!plan || !plan.id) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Calculate price
    const price = validatedData.billingPeriod === 'yearly' 
      ? (plan.price_yearly || (plan.price_monthly ? plan.price_monthly * 12 * 0.8 : 0))
      : (plan.price_monthly || 0);

    // Calculate period dates
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    
    let periodEnd: Date;
    if (validatedData.billingPeriod === 'yearly') {
      periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    const periodEndDate = periodEnd.toISOString().split('T')[0];

    // Create or update subscription
    const existingSubscriptions = await db.select<{
      id: string;
    }>('subscriptions', {
      eq: { organization_id: user.organizationId },
      limit: 1,
    });

    const subscriptionData: any = {
      organization_id: user.organizationId,
      plan_id: plan.id,
      billing_period: validatedData.billingPeriod,
      price: price,
      currency: 'XOF',
      status: paymentResult.status === 'completed' ? 'active' : 'trialing',
      start_date: startDate,
      current_period_start: startDate,
      current_period_end: periodEndDate,
      updated_at: new Date().toISOString(),
    };

    // Add payment provider specific IDs
    if (validatedData.paymentMethod === 'stripe' && paymentResult.transactionId) {
      subscriptionData.stripe_subscription_id = paymentResult.transactionId;
    }

    let subscriptionId: string;
    if (existingSubscriptions.length === 0) {
      subscriptionData.created_at = new Date().toISOString();
      const newSubscription = await db.insertOne<{ id: string }>('subscriptions', subscriptionData);
      if (!newSubscription || !newSubscription.id) {
        return NextResponse.json(
          { error: 'Failed to create subscription' },
          { status: 500 }
        );
      }
      subscriptionId = newSubscription.id;
    } else {
      subscriptionId = existingSubscriptions[0].id;
      await db.update('subscriptions', subscriptionData, {
        eq: { id: subscriptionId },
      });
    }

    // Create subscription payment record
    const paymentStatus = paymentResult.status === 'completed' 
      ? 'completed' 
      : paymentResult.status === 'pending' 
      ? 'processing' 
      : 'failed';

    const subscriptionPaymentData: any = {
      subscription_id: subscriptionId,
      organization_id: user.organizationId,
      amount: price,
      currency: 'XOF',
      payment_method: validatedData.paymentMethod,
      billing_period_start: startDate,
      billing_period_end: periodEndDate,
      status: paymentStatus,
      transaction_id: paymentResult.transactionId || null,
      provider_customer_id: paymentResult.providerCustomerId || null,
      provider_subscription_id: paymentResult.providerSubscriptionId || null,
      gateway_response: paymentResult.gatewayResponse || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Set timestamps based on status
    if (paymentStatus === 'completed') {
      subscriptionPaymentData.paid_at = new Date().toISOString();
    } else if (paymentStatus === 'failed') {
      subscriptionPaymentData.failed_at = new Date().toISOString();
      subscriptionPaymentData.failure_reason = paymentResult.failureReason || 'Payment processing failed';
    }

    await db.insertOne('subscription_payments', subscriptionPaymentData);

    return NextResponse.json({
      success: true,
      message: paymentResult.message || 'Payment processed successfully',
      subscription: {
        status: paymentResult.status === 'completed' ? 'active' : 'trialing',
        transactionId: paymentResult.transactionId,
      },
      payment: {
        status: paymentStatus,
        transactionId: paymentResult.transactionId,
      },
    });

  } catch (error) {
    console.error('Payment processing error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payment data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Payment processor functions
async function processStripePayment(params: {
  planName: string;
  billingPeriod: 'monthly' | 'yearly';
  organizationId: string;
  paymentData?: Record<string, any>;
}): Promise<PaymentResult> {
  // TODO: Implement Stripe payment processing
  // This would integrate with Stripe API
  // For now, return a mock success response
  
  console.log('[Payment] Processing Stripe payment', params);
  
  // In production, this would:
  // 1. Create a Stripe customer
  // 2. Create a Stripe subscription
  // 3. Handle payment intent
  // 4. Return transaction ID
  
  return {
    success: true,
    transactionId: `stripe_${Date.now()}`,
    status: 'completed',
    message: 'Stripe payment processed successfully',
    providerCustomerId: `cus_${Date.now()}`,
    providerSubscriptionId: `sub_${Date.now()}`,
    gatewayResponse: {
      provider: 'stripe',
      payment_intent_id: `pi_${Date.now()}`,
      customer_id: `cus_${Date.now()}`,
    },
  };
}

async function processPayPalPayment(params: {
  planName: string;
  billingPeriod: 'monthly' | 'yearly';
  organizationId: string;
  paymentData?: Record<string, any>;
}): Promise<PaymentResult> {
  // TODO: Implement PayPal payment processing
  console.log('[Payment] Processing PayPal payment', params);
  
  return {
    success: true,
    transactionId: `paypal_${Date.now()}`,
    status: 'completed',
    message: 'PayPal payment processed successfully',
    providerCustomerId: `paypal_customer_${Date.now()}`,
    providerSubscriptionId: `paypal_sub_${Date.now()}`,
    gatewayResponse: {
      provider: 'paypal',
      order_id: `order_${Date.now()}`,
      payer_id: `payer_${Date.now()}`,
    },
  };
}

async function processWavePayment(params: {
  planName: string;
  billingPeriod: 'monthly' | 'yearly';
  organizationId: string;
  paymentData?: Record<string, any>;
}): Promise<PaymentResult> {
  // TODO: Implement Wave payment processing
  // This would integrate with Wave API
  console.log('[Payment] Processing Wave payment', params);
  
  return {
    success: true,
    transactionId: `wave_${Date.now()}`,
    status: 'completed',
    message: 'Wave payment processed successfully',
    providerCustomerId: `wave_customer_${Date.now()}`,
    gatewayResponse: {
      provider: 'wave',
      wave_transaction_id: `wave_tx_${Date.now()}`,
      merchant_id: params.paymentData?.merchantId || null,
    },
  };
}

async function processOrangeMoneyPayment(params: {
  planName: string;
  billingPeriod: 'monthly' | 'yearly';
  organizationId: string;
  paymentData?: Record<string, any>;
}): Promise<PaymentResult> {
  // TODO: Implement Orange Money payment processing
  // This would integrate with Orange Money API
  console.log('[Payment] Processing Orange Money payment', params);
  
  return {
    success: true,
    transactionId: `orange_${Date.now()}`,
    status: 'completed',
    message: 'Orange Money payment processed successfully',
    providerCustomerId: params.paymentData?.phoneNumber || null,
    gatewayResponse: {
      provider: 'orange_money',
      orange_transaction_id: `orange_tx_${Date.now()}`,
      phone_number: params.paymentData?.phoneNumber || null,
    },
  };
}

