import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { leases, units, tenants, properties } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';
import { z } from 'zod';

const updateLeaseSchema = z.object({
  unitId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().optional(),
  rentAmount: z.number().min(0).optional(),
  depositPaid: z.boolean().optional(),
  signed: z.boolean().optional(),
  signatureUrl: z.string().optional(),
});

/**
 * GET /api/leases/[id]
 * Get a single lease by ID
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

    const leaseRecords = await db
      .select()
      .from(leases)
      .where(eq(leases.id, id))
      .limit(1);

    const lease = leaseRecords[0];

    if (!lease) {
      return NextResponse.json(
        { error: 'Lease not found' },
        { status: 404 }
      );
    }

    // Verify lease belongs to user's organization
    if (lease.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get unit, tenant, and property details
    let unitNumber = 'N/A';
    let propertyName = 'N/A';
    let propertyId = null;
    let tenantName = 'N/A';
    let tenantFirstName = '';
    let tenantLastName = '';

    if (lease.unitId) {
      const unitRecords = await db
        .select()
        .from(units)
        .where(eq(units.id, lease.unitId))
        .limit(1);

      const unit = unitRecords[0];
      if (unit) {
        unitNumber = unit.unitNumber || 'N/A';

        if (unit.propertyId) {
          propertyId = unit.propertyId;
          const propertyRecords = await db
            .select()
            .from(properties)
            .where(eq(properties.id, unit.propertyId))
            .limit(1);

          const property = propertyRecords[0];
          if (property) {
            propertyName = property.name || 'N/A';
          }
        }
      }
    }

    if (lease.tenantId) {
      const tenantRecords = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, lease.tenantId))
        .limit(1);

      const tenant = tenantRecords[0];
      if (tenant) {
        tenantName = `${tenant.firstName} ${tenant.lastName}`;
        tenantFirstName = tenant.firstName;
        tenantLastName = tenant.lastName;
      }
    }

    return NextResponse.json({
      id: lease.id,
      unitId: lease.unitId,
      tenantId: lease.tenantId,
      startDate: lease.startDate,
      endDate: lease.endDate,
      rentAmount: lease.rentAmount ? parseFloat(lease.rentAmount) : null,
      depositPaid: lease.depositPaid || false,
      signed: lease.signed || false,
      signatureUrl: lease.signatureUrl,
      unitNumber,
      propertyName,
      propertyId,
      tenantName,
      tenantFirstName,
      tenantLastName,
      createdAt: lease.createdAt,
    });
  } catch (error) {
    console.error('Error fetching lease:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leases/[id]
 * Update a lease
 */
export async function PATCH(
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
    const body = await req.json();
    const validatedData = updateLeaseSchema.parse(body);

    // Verify lease exists and belongs to organization
    const leaseRecords = await db
      .select()
      .from(leases)
      .where(eq(leases.id, id))
      .limit(1);

    const lease = leaseRecords[0];

    if (!lease) {
      return NextResponse.json(
        { error: 'Lease not found' },
        { status: 404 }
      );
    }

    if (lease.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (validatedData.unitId !== undefined) updateData.unitId = validatedData.unitId;
    if (validatedData.tenantId !== undefined) updateData.tenantId = validatedData.tenantId;
    if (validatedData.startDate !== undefined) updateData.startDate = validatedData.startDate;
    if (validatedData.endDate !== undefined) updateData.endDate = validatedData.endDate || null;
    if (validatedData.rentAmount !== undefined) updateData.rentAmount = validatedData.rentAmount.toString();
    if (validatedData.depositPaid !== undefined) updateData.depositPaid = validatedData.depositPaid;
    if (validatedData.signed !== undefined) updateData.signed = validatedData.signed;
    if (validatedData.signatureUrl !== undefined) updateData.signatureUrl = validatedData.signatureUrl || null;

    // Update lease
    const [updatedLease] = await db
      .update(leases)
      .set(updateData)
      .where(eq(leases.id, id))
      .returning();

    return NextResponse.json(updatedLease);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating lease:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leases/[id]
 * Delete a lease
 */
export async function DELETE(
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

    // Verify lease exists and belongs to organization
    const leaseRecords = await db
      .select()
      .from(leases)
      .where(eq(leases.id, id))
      .limit(1);

    const lease = leaseRecords[0];

    if (!lease) {
      return NextResponse.json(
        { error: 'Lease not found' },
        { status: 404 }
      );
    }

    if (lease.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update unit status to vacant
    if (lease.unitId) {
      await db
        .update(units)
        .set({ status: 'vacant' })
        .where(eq(units.id, lease.unitId));
    }

    // Delete lease
    await db
      .delete(leases)
      .where(eq(leases.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lease:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

