import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { payments, tenants, units, properties, paymentMethods, leases } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/payments/[id]
 * Get a single payment by ID with all related information
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
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
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    // Get payment with all related information
    const paymentResult = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        feeAmount: payments.feeAmount,
        status: payments.status,
        transactionId: payments.transactionId,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
        notes: payments.notes,
        tenantId: payments.tenantId,
        tenantFirstName: tenants.firstName,
        tenantLastName: tenants.lastName,
        tenantEmail: tenants.email,
        tenantPhone: tenants.phone,
        tenantAddress: tenants.address,
        unitId: payments.unitId,
        unitNumber: units.unitNumber,
        unitFloor: units.floor,
        unitSurface: units.surface,
        propertyId: units.propertyId,
        propertyName: properties.name,
        propertyAddress: properties.address,
        propertyCity: properties.city,
        paymentMethodId: payments.paymentMethodId,
        paymentMethodName: paymentMethods.name,
        paymentMethodProvider: paymentMethods.provider,
        leaseId: payments.leaseId,
      })
      .from(payments)
      .leftJoin(tenants, eq(payments.tenantId, tenants.id))
      .leftJoin(units, eq(payments.unitId, units.id))
      .leftJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(paymentMethods, eq(payments.paymentMethodId, paymentMethods.id))
      .where(
        and(
          eq(payments.id, id),
          eq(payments.organizationId, user.organizationId)
        )
      )
      .limit(1);

    const payment = paymentResult[0];

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Get lease information if available
    let lease = null;
    if (payment.leaseId) {
      const leaseResult = await db
        .select({
          id: leases.id,
          startDate: leases.startDate,
          endDate: leases.endDate,
          rentAmount: leases.rentAmount,
          chargesAmount: leases.chargesAmount,
          depositAmount: leases.depositAmount,
        })
        .from(leases)
        .where(eq(leases.id, payment.leaseId))
        .limit(1);
      
      lease = leaseResult[0] || null;
    }

    return NextResponse.json({
      id: payment.id,
      amount: parseFloat(payment.amount.toString()),
      feeAmount: parseFloat(payment.feeAmount?.toString() || '0'),
      status: payment.status,
      transactionId: payment.transactionId,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      notes: payment.notes,
      tenant: {
        id: payment.tenantId,
        firstName: payment.tenantFirstName,
        lastName: payment.tenantLastName,
        email: payment.tenantEmail,
        phone: payment.tenantPhone,
        address: payment.tenantAddress,
      },
      unit: {
        id: payment.unitId,
        unitNumber: payment.unitNumber,
        floor: payment.unitFloor,
        surface: payment.unitSurface ? parseFloat(payment.unitSurface.toString()) : null,
      },
      property: {
        id: payment.propertyId,
        name: payment.propertyName,
        address: payment.propertyAddress,
        city: payment.propertyCity,
      },
      paymentMethod: {
        id: payment.paymentMethodId,
        name: payment.paymentMethodName,
        provider: payment.paymentMethodProvider,
      },
      lease: lease ? {
        id: lease.id,
        startDate: lease.startDate,
        endDate: lease.endDate,
        rentAmount: parseFloat(lease.rentAmount?.toString() || '0'),
        chargesAmount: parseFloat(lease.chargesAmount?.toString() || '0'),
        depositAmount: parseFloat(lease.depositAmount?.toString() || '0'),
      } : null,
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

