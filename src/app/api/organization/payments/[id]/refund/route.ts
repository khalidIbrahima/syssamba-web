import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for refund data
const refundSchema = z.object({
  reason: z.string().min(1, 'La raison du remboursement est requise'),
  amount: z.number().positive().optional(), // Optional for partial refunds
});

/**
 * POST /api/organization/payments/[id]/refund
 * Process a refund for a subscription payment
 */
export async function POST(
  request: NextRequest,
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
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'User or organization not found' },
        { status: 404 }
      );
    }

    const resolvedParams = await params;
    const paymentId = resolvedParams.id;

    // Get the payment
    const payment = await db.selectOne<{
      id: string;
      organization_id: string;
      subscription_id: string;
      amount: number;
      currency: string;
      payment_method: string;
      status: string;
      transaction_id: string | null;
      refunded_amount: number | null;
      gateway_response: any;
    }>('subscription_payments', {
      eq: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify payment belongs to user's organization
    if (payment.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized: Payment does not belong to your organization' },
        { status: 403 }
      );
    }

    // Check if payment can be refunded
    if (payment.status !== 'completed') {
      return NextResponse.json(
        { error: `Payment cannot be refunded. Current status: ${payment.status}` },
        { status: 400 }
      );
    }

    // Check if already refunded
    if (payment.refunded_amount !== null && payment.refunded_amount >= payment.amount) {
      return NextResponse.json(
        { error: 'Payment has already been fully refunded' },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = refundSchema.parse(body);

    // Calculate refund amount (full refund if not specified)
    const refundAmount = validatedData.amount || payment.amount;
    const currentRefundedAmount = payment.refunded_amount || 0;
    const totalRefundedAfter = currentRefundedAmount + refundAmount;

    if (totalRefundedAfter > payment.amount) {
      return NextResponse.json(
        { 
          error: `Refund amount exceeds payment amount. Maximum refundable: ${payment.amount - currentRefundedAmount}` 
        },
        { status: 400 }
      );
    }

    // Process refund with payment provider
    const refundResult = await processRefund({
      paymentMethod: payment.payment_method,
      transactionId: payment.transaction_id,
      amount: refundAmount,
      currency: payment.currency,
      gatewayResponse: payment.gateway_response,
    });

    if (!refundResult.success) {
      return NextResponse.json(
        { error: refundResult.message || 'Refund processing failed' },
        { status: 400 }
      );
    }

    // Update payment record
    const isFullRefund = totalRefundedAfter >= payment.amount;
    const updateData: any = {
      refunded_amount: totalRefundedAfter,
      refund_reason: validatedData.reason,
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update status if full refund
    if (isFullRefund) {
      updateData.status = 'refunded';
    }

    await db.update('subscription_payments', updateData, {
      eq: { id: paymentId },
    });

    // If full refund, update subscription status
    if (isFullRefund) {
      // Get subscription
      const subscription = await db.selectOne<{
        id: string;
        status: string;
      }>('subscriptions', {
        eq: { id: payment.subscription_id },
      });

      if (subscription && subscription.status === 'active') {
        // Cancel subscription if it was active
        await db.update('subscriptions', {
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          eq: { id: subscription.id },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: refundResult.message || 'Refund processed successfully',
      refund: {
        amount: refundAmount,
        totalRefunded: totalRefundedAfter,
        isFullRefund,
        transactionId: refundResult.transactionId,
      },
    });
  } catch (error: any) {
    console.error('Refund processing error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid refund data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Process refund with payment provider
 */
async function processRefund(params: {
  paymentMethod: string;
  transactionId: string | null;
  amount: number;
  currency: string;
  gatewayResponse: any;
}): Promise<{
  success: boolean;
  transactionId?: string;
  message: string;
}> {
  console.log('[Refund] Processing refund', params);

  // TODO: Implement actual refund processing with payment providers
  // This would integrate with:
  // - Stripe API for refunds
  // - PayPal API for refunds
  // - Wave API for refunds
  // - Orange Money API for refunds

  // For now, return a mock success response
  return {
    success: true,
    transactionId: `refund_${Date.now()}`,
    message: `${params.paymentMethod} refund processed successfully`,
  };
}

