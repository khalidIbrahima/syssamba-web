import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db, supabaseAdmin } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/payments
 * Get all tenant payments for the current organization
 */
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const tenantId = searchParams.get('tenantId') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build query with joins using Supabase PostgREST syntax
    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        tenant:tenants(first_name, last_name, email, phone),
        unit:units(unit_number, property_id, property:properties(name))
      `)
      .eq('organization_id', user.organizationId);

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply tenant filter
    if (tenantId !== 'all') {
      query = query.eq('tenant_id', tenantId);
    }

    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data: paymentsList, error: paymentsError } = await query;

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      throw paymentsError;
    }

    // Get payment methods separately (since Supabase nested selects can be complex)
    const paymentMethodIds = [...new Set(
      (paymentsList || [])
        .map((p: any) => p.payment_method_id)
        .filter((id: string) => id)
    )];

    const paymentMethodsMap: Record<string, any> = {};
    if (paymentMethodIds.length > 0) {
      const { data: methods } = await supabaseAdmin
        .from('payment_methods')
        .select('id, name, provider')
        .in('id', paymentMethodIds);

      (methods || []).forEach((method: any) => {
        paymentMethodsMap[method.id] = method;
      });
    }

    // Get total count
    let countQuery = supabaseAdmin
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', user.organizationId);

    if (status !== 'all') {
      countQuery = countQuery.eq('status', status);
    }

    if (tenantId !== 'all') {
      countQuery = countQuery.eq('tenant_id', tenantId);
    }

    const { count: totalCount } = await countQuery;

    // Calculate statistics using RPC or multiple queries
    // For now, we'll fetch all payments and calculate stats in memory
    const allPayments = await db.select<{
      amount: string;
      fee_amount: string | null;
      status: string;
    }>('payments', {
      eq: { organization_id: user.organizationId },
    });

    // Calculate statistics
    const stats = {
      totalAmount: 0,
      completedAmount: 0,
      pendingAmount: 0,
      failedAmount: 0,
      totalFees: 0,
      completedCount: 0,
      pendingCount: 0,
      failedCount: 0,
    };

    allPayments.forEach((p) => {
      const amount = parseFloat(p.amount || '0');
      const feeAmount = parseFloat(p.fee_amount || '0');
      
      stats.totalAmount += amount;
      stats.totalFees += feeAmount;

      if (p.status === 'completed') {
        stats.completedAmount += amount;
        stats.completedCount++;
      } else if (p.status === 'pending') {
        stats.pendingAmount += amount;
        stats.pendingCount++;
      } else if (p.status === 'failed') {
        stats.failedAmount += amount;
        stats.failedCount++;
      }
    });

    return NextResponse.json({
      payments: (paymentsList || []).map((p: any) => {
        const tenant = Array.isArray(p.tenant) ? p.tenant[0] : p.tenant;
        const unit = Array.isArray(p.unit) ? p.unit[0] : p.unit;
        const property = unit?.property ? (Array.isArray(unit.property) ? unit.property[0] : unit.property) : null;
        const paymentMethod = p.payment_method_id ? paymentMethodsMap[p.payment_method_id] : null;

        return {
          id: p.id,
          amount: parseFloat(p.amount?.toString() || '0'),
          feeAmount: parseFloat(p.fee_amount?.toString() || '0'),
          status: p.status,
          transactionId: p.transaction_id,
          paidAt: p.paid_at,
          createdAt: p.created_at,
          tenant: tenant ? {
            id: p.tenant_id,
            firstName: tenant.first_name,
            lastName: tenant.last_name,
            email: tenant.email,
            phone: tenant.phone,
          } : null,
          unit: unit ? {
            id: p.unit_id,
            unitNumber: unit.unit_number,
          } : null,
          property: property ? {
            id: unit.property_id,
            name: property.name,
          } : null,
          paymentMethod: paymentMethod ? {
            id: p.payment_method_id,
            name: paymentMethod.name,
            provider: paymentMethod.provider,
          } : null,
        };
      }),
      stats,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
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

