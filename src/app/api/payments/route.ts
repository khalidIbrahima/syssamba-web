import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

/**
 * GET /api/payments
 * Get tenant payments with statistics and filters
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await checkAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'all';
    const tenantId = searchParams.get('tenantId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 20;

    // Build query conditions
    const conditions: any = {
      eq: { organization_id: user.organizationId },
    };

    if (status !== 'all') {
      conditions.eq.status = status;
    }

    if (tenantId) {
      conditions.eq.tenant_id = tenantId;
    }

    // Get all payments for statistics (before pagination)
    const allPayments = await db.select<{
      id: string;
      tenant_id: string;
      unit_id: string;
      amount: string;
      fee_amount: string;
      status: string;
      paid_at: string | null;
      created_at: string;
      payment_method_id: string | null;
    }>('payments', conditions) || [];

    // Calculate statistics
    const totalAmount = allPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
    const completedAmount = allPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
    const pendingAmount = allPayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
    const failedAmount = allPayments
      .filter(p => p.status === 'failed')
      .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
    const totalFees = allPayments.reduce((sum, p) => sum + parseFloat(p.fee_amount || '0'), 0);
    const completedCount = allPayments.filter(p => p.status === 'completed').length;
    const pendingCount = allPayments.filter(p => p.status === 'pending').length;
    const failedCount = allPayments.filter(p => p.status === 'failed').length;

    // Get paginated payments
    const offset = (page - 1) * limit;
    const paginatedPayments = allPayments.slice(offset, offset + limit);

    // Fetch related data for paginated payments
    const paymentsWithDetails = await Promise.all(
      paginatedPayments.map(async (payment) => {
        // Get tenant details
        let tenant = null;
        if (payment.tenant_id) {
          const tenants = await db.selectOne<{
            id: string;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
          }>('tenants', {
            eq: { id: payment.tenant_id },
          });
          tenant = tenants;
        }

        // Get unit details
        let unit = null;
        let property = null;
        if (payment.unit_id) {
          const units = await db.selectOne<{
            id: string;
            unit_number: string;
            property_id: string;
          }>('units', {
            eq: { id: payment.unit_id },
          });
          unit = units;

          if (unit && unit.property_id) {
            const properties = await db.selectOne<{
              id: string;
              name: string;
            }>('properties', {
              eq: { id: unit.property_id },
            });
            property = properties;
          }
        }

        // Get payment method details
        let paymentMethod = null;
        if (payment.payment_method_id) {
          const methods = await db.selectOne<{
            id: string;
            name: string;
            slug: string;
          }>('payment_methods', {
            eq: { id: payment.payment_method_id },
          });
          paymentMethod = methods;
        }

        return {
          id: payment.id,
          amount: parseFloat(payment.amount || '0'),
          feeAmount: parseFloat(payment.fee_amount || '0'),
          status: payment.status,
          paidAt: payment.paid_at,
          createdAt: payment.created_at,
          tenant: tenant ? {
            id: tenant.id,
            firstName: tenant.first_name,
            lastName: tenant.last_name,
            email: tenant.email,
            phone: tenant.phone,
          } : null,
          unit: unit ? {
            id: unit.id,
            unitNumber: unit.unit_number,
          } : null,
          property: property ? {
            id: property.id,
            name: property.name,
          } : null,
          paymentMethod: paymentMethod ? {
            id: paymentMethod.id,
            name: paymentMethod.name,
            slug: paymentMethod.slug,
          } : null,
        };
      })
    );

    return NextResponse.json({
      stats: {
        totalAmount,
        completedAmount,
        pendingAmount,
        failedAmount,
        totalFees,
        completedCount,
        pendingCount,
        failedCount,
      },
      payments: paymentsWithDetails,
      pagination: {
        page,
        limit,
        total: allPayments.length,
        totalPages: Math.ceil(allPayments.length / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

