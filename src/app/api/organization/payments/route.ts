import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

/**
 * GET /api/organization/payments
 * Get payment history for the current user's organization
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status
    const paymentMethod = searchParams.get('payment_method'); // Filter by payment method
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query conditions
    const conditions: any = {
      eq: { organization_id: user.organizationId },
    };

    if (status) {
      conditions.eq.status = status;
    }

    if (paymentMethod) {
      conditions.eq.payment_method = paymentMethod;
    }

    // Get subscription payments
    const payments = await db.select<{
      id: string;
      subscription_id: string;
      amount: number;
      currency: string;
      payment_method: string;
      billing_period_start: string;
      billing_period_end: string;
      status: string;
      transaction_id: string | null;
      provider_customer_id: string | null;
      provider_subscription_id: string | null;
      gateway_response: any;
      failure_reason: string | null;
      refund_reason: string | null;
      refunded_at: string | null;
      refunded_amount: number | null;
      paid_at: string | null;
      failed_at: string | null;
      created_at: string;
      updated_at: string;
    }>('subscription_payments', {
      ...conditions,
      orderBy: { column: 'created_at', ascending: false },
      limit,
      offset,
    });

    // Get total count for pagination
    const allPayments = await db.select<{ id: string }>('subscription_payments', {
      eq: { organization_id: user.organizationId },
    });

    // Get subscription details for each payment
    const paymentsWithDetails = await Promise.all(
      payments.map(async (payment) => {
        // Get subscription details
        const subscription = await db.selectOne<{
          id: string;
          plan_id: string;
          billing_period: string;
          status: string;
        }>('subscriptions', {
          eq: { id: payment.subscription_id },
        });

        // Get plan details
        let planName = null;
        if (subscription?.plan_id) {
          const plan = await db.selectOne<{
            name: string;
            display_name: string;
          }>('plans', {
            eq: { id: subscription.plan_id },
          });
          planName = plan?.display_name || plan?.name || null;
        }

        return {
          id: payment.id,
          subscriptionId: payment.subscription_id,
          amount: parseFloat(String(payment.amount)),
          currency: payment.currency,
          paymentMethod: payment.payment_method,
          billingPeriodStart: payment.billing_period_start,
          billingPeriodEnd: payment.billing_period_end,
          status: payment.status,
          transactionId: payment.transaction_id,
          providerCustomerId: payment.provider_customer_id,
          providerSubscriptionId: payment.provider_subscription_id,
          gatewayResponse: payment.gateway_response,
          failureReason: payment.failure_reason,
          refundReason: payment.refund_reason,
          refundedAt: payment.refunded_at,
          refundedAmount: payment.refunded_amount ? parseFloat(String(payment.refunded_amount)) : null,
          paidAt: payment.paid_at,
          failedAt: payment.failed_at,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at,
          planName,
          subscriptionStatus: subscription?.status || null,
        };
      })
    );

    return NextResponse.json({
      payments: paymentsWithDetails,
      pagination: {
        total: allPayments.length,
        limit,
        offset,
        hasMore: offset + limit < allPayments.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

