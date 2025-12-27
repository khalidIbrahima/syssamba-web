import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { leases, units, tenants, properties } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';
import { z } from 'zod';

const createLeaseSchema = z.object({
  unitId: z.string().min(1, 'Le lot est requis'),
  tenantId: z.string().min(1, 'Le locataire est requis'),
  startDate: z.string().min(1, 'La date de début est requise'),
  endDate: z.string().optional(),
  rentAmount: z.number().min(0, 'Le loyer doit être positif').optional(),
  depositPaid: z.boolean().default(false),
  signed: z.boolean().default(false),
  signatureUrl: z.string().optional(),
});

/**
 * GET /api/leases
 * Get all leases for the current organization
 */
export async function GET() {
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

    const leasesList = await db
      .select()
      .from(leases)
      .where(eq(leases.organizationId, user.organizationId))
      .orderBy(desc(leases.createdAt));

    // Get unit, tenant, and property details for each lease
    const leasesWithDetails = await Promise.all(
      leasesList.map(async (lease) => {
        let unitNumber = 'N/A';
        let propertyName = 'N/A';
        let tenantName = 'N/A';

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
          }
        }

        return {
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
          tenantName,
          createdAt: lease.createdAt,
        };
      })
    );

    return NextResponse.json(leasesWithDetails);
  } catch (error) {
    console.error('Error fetching leases:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leases
 * Create a new lease
 */
export async function POST(req: Request) {
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

    const body = await req.json();
    const validatedData = createLeaseSchema.parse(body);

    // Verify unit belongs to organization
    const unitRecords = await db
      .select()
      .from(units)
      .where(eq(units.id, validatedData.unitId))
      .limit(1);

    const unit = unitRecords[0];
    if (!unit || unit.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Unit not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Verify tenant belongs to organization
    const tenantRecords = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, validatedData.tenantId))
      .limit(1);

    const tenant = tenantRecords[0];
    if (!tenant || tenant.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Tenant not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Check if unit already has an active lease
    const existingLease = await db
      .select()
      .from(leases)
      .where(eq(leases.unitId, validatedData.unitId))
      .limit(1);

    if (existingLease.length > 0) {
      const existing = existingLease[0];
      const today = new Date();
      const endDate = existing.endDate ? new Date(existing.endDate) : null;
      
      if (!endDate || endDate > today) {
        return NextResponse.json(
          { error: 'This unit already has an active lease' },
          { status: 400 }
        );
      }
    }

    // Create lease
    const [newLease] = await db
      .insert(leases)
      .values({
        organizationId: user.organizationId,
        unitId: validatedData.unitId,
        tenantId: validatedData.tenantId,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate || null,
        rentAmount: validatedData.rentAmount ? validatedData.rentAmount.toString() : null,
        depositPaid: validatedData.depositPaid,
        signed: validatedData.signed,
        signatureUrl: validatedData.signatureUrl || null,
      })
      .returning();

    // Update unit status to occupied
    await db
      .update(units)
      .set({ status: 'occupied' })
      .where(eq(units.id, validatedData.unitId));

    return NextResponse.json(newLease, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating lease:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

