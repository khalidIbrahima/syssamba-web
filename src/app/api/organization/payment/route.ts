import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for payment data
const paymentSchema = z.object({
  planName: z.string().min(1, 'Le nom du plan est requis'),
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
      // Get plan details
      const plan = await db.selectOne<{
        id: string;
        name: string;
        price_monthly: number | null;
        price_yearly: number | null;
      }>('plans', {
        eq: { name: validatedData.planName },
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

      if (existingSubscriptions.length === 0) {
        await db.insertOne('subscriptions', {
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
      } else {
        await db.update('subscriptions', {
          plan_id: plan.id,
          billing_period: validatedData.billingPeriod,
          price: price,
          status: 'active',
          current_period_start: startDate,
          current_period_end: periodEndDate,
          updated_at: new Date().toISOString(),
        }, {
          eq: { id: existingSubscriptions[0].id },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Payment skipped in dev mode',
        subscription: {
          status: 'active',
        },
      });
    }

    // Process actual payment based on payment method
    let paymentResult: {
      success: boolean;
      transactionId?: string;
      status: 'completed' | 'pending' | 'failed';
      message: string;
    };

    switch (validatedData.paymentMethod) {
      case 'stripe':
        paymentResult = await processStripePayment({
          planName: validatedData.planName,
          billingPeriod: validatedData.billingPeriod,
          organizationId: user.organizationId,
          paymentData: validatedData.paymentData,
        });
        break;

      case 'paypal':
        paymentResult = await processPayPalPayment({
          planName: validatedData.planName,
          billingPeriod: validatedData.billingPeriod,
          organizationId: user.organizationId,
          paymentData: validatedData.paymentData,
        });
        break;

      case 'wave':
        paymentResult = await processWavePayment({
          planName: validatedData.planName,
          billingPeriod: validatedData.billingPeriod,
          organizationId: user.organizationId,
          paymentData: validatedData.paymentData,
        });
        break;

      case 'orange_money':
        paymentResult = await processOrangeMoneyPayment({
          planName: validatedData.planName,
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

    // Get plan details
    const plan = await db.selectOne<{
      id: string;
      name: string;
      price_monthly: number | null;
      price_yearly: number | null;
    }>('plans', {
      eq: { name: validatedData.planName },
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

    if (existingSubscriptions.length === 0) {
      subscriptionData.created_at = new Date().toISOString();
      await db.insertOne('subscriptions', subscriptionData);
    } else {
      await db.update('subscriptions', subscriptionData, {
        eq: { id: existingSubscriptions[0].id },
      });
    }

    return NextResponse.json({
      success: true,
      message: paymentResult.message || 'Payment processed successfully',
      subscription: {
        status: paymentResult.status === 'completed' ? 'active' : 'trialing',
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
}): Promise<{ success: boolean; transactionId?: string; status: 'completed' | 'pending' | 'failed'; message: string }> {
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
  };
}

async function processPayPalPayment(params: {
  planName: string;
  billingPeriod: 'monthly' | 'yearly';
  organizationId: string;
  paymentData?: Record<string, any>;
}): Promise<{ success: boolean; transactionId?: string; status: 'completed' | 'pending' | 'failed'; message: string }> {
  // TODO: Implement PayPal payment processing
  console.log('[Payment] Processing PayPal payment', params);
  
  return {
    success: true,
    transactionId: `paypal_${Date.now()}`,
    status: 'completed',
    message: 'PayPal payment processed successfully',
  };
}

async function processWavePayment(params: {
  planName: string;
  billingPeriod: 'monthly' | 'yearly';
  organizationId: string;
  paymentData?: Record<string, any>;
}): Promise<{ success: boolean; transactionId?: string; status: 'completed' | 'pending' | 'failed'; message: string }> {
  // TODO: Implement Wave payment processing
  // This would integrate with Wave API
  console.log('[Payment] Processing Wave payment', params);
  
  return {
    success: true,
    transactionId: `wave_${Date.now()}`,
    status: 'completed',
    message: 'Wave payment processed successfully',
  };
}

async function processOrangeMoneyPayment(params: {
  planName: string;
  billingPeriod: 'monthly' | 'yearly';
  organizationId: string;
  paymentData?: Record<string, any>;
}): Promise<{ success: boolean; transactionId?: string; status: 'completed' | 'pending' | 'failed'; message: string }> {
  // TODO: Implement Orange Money payment processing
  // This would integrate with Orange Money API
  console.log('[Payment] Processing Orange Money payment', params);
  
  return {
    success: true,
    transactionId: `orange_${Date.now()}`,
    status: 'completed',
    message: 'Orange Money payment processed successfully',
  };
}

