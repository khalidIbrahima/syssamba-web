import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { logEntityCreated, getRequestMetadata } from '@/lib/activity-tracker';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { z } from 'zod';

const createTenantSchema = z.object({
  unitId: z.string().min(1, 'Le lot est requis'),
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  idNumber: z.string().optional(),
  hasExtranetAccess: z.boolean().default(false),
  language: z.enum(['fr', 'en', 'wo']).default('fr'),
});

/**
 * GET /api/tenants
 * Get all tenants for the current organization
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

    // Check profile permissions for Tenant read
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (userRecord?.profile_id) {
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const tenantPermission = objectPermissions.find(p => p.objectType === 'Tenant');
      const canReadTenants = tenantPermission?.canRead || false;

      if (!canReadTenants) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view tenants' },
          { status: 403 }
        );
      }
    }

    const tenantsList = await db.select<{
      id: string;
      organization_id: string;
      unit_id: string | null;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      id_number: string | null;
      has_extranet_access: boolean;
      language: string;
      created_at: Date | string;
    }>('tenants', {
      eq: { organization_id: user.organizationId },
    });

    // Get unit, property, lease, and payment info for each tenant
    const tenantsWithDetails = await Promise.all(
      tenantsList.map(async (tenant) => {
        let unitNumber = 'N/A';
        let propertyName = 'N/A';
        let unitId = null;
        let rentAmount = null;
        let leaseStatus = null;
        let leaseEndDate = null;
        let paymentStatus = 'up_to_date';
        let daysLate = 0;
        let lastPaymentDate = null;

        if (tenant.unit_id) {
          unitId = tenant.unit_id;
          const unit = await db.selectOne<{
            id: string;
            unit_number: string;
            rent_amount: string;
            property_id: string | null;
          }>('units', {
            eq: { id: tenant.unit_id },
          });

          if (unit) {
            unitNumber = unit.unit_number || 'N/A';
            rentAmount = unit.rent_amount ? parseFloat(unit.rent_amount) : null;

            if (unit.property_id) {
              const property = await db.selectOne<{
                id: string;
                name: string;
              }>('properties', {
                eq: { id: unit.property_id },
              });

              if (property) {
                propertyName = property.name || 'N/A';
              }
            }
          }
        }

        // Get current lease for this tenant
        const leaseRecords = await db.select<{
          id: string;
          tenant_id: string;
          organization_id: string;
          start_date: Date | string;
          end_date: Date | string | null;
        }>('leases', {
          eq: { tenant_id: tenant.id, organization_id: user.organizationId },
          orderBy: { column: 'start_date', ascending: false },
          limit: 1,
        });

        const currentLease = leaseRecords[0];
        if (currentLease) {
          leaseStatus = 'active';
          leaseEndDate = currentLease.end_date;
          
          // Check if lease is expired or in notice period
          if (currentLease.end_date) {
            const endDate = new Date(currentLease.end_date);
            const today = new Date();
            const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilEnd < 0) {
              leaseStatus = 'expired';
            } else if (daysUntilEnd <= 60) {
              leaseStatus = 'notice';
            }
          }

          // Get latest payment for this tenant
          const paymentRecords = await db.select<{
            id: string;
            tenant_id: string;
            status: string;
            paid_at: Date | string | null;
            created_at: Date | string;
          }>('payments', {
            eq: { tenant_id: tenant.id },
            orderBy: { column: 'created_at', ascending: false },
            limit: 1,
          });

          const latestPayment = paymentRecords[0];
          if (latestPayment) {
            lastPaymentDate = latestPayment.paid_at;
            const paymentDate = latestPayment.paid_at ? new Date(latestPayment.paid_at) : new Date(latestPayment.created_at);
            const today = new Date();
            
            if (latestPayment.status === 'completed') {
              paymentStatus = 'up_to_date';
              // Check if payment is recent (within last 30 days)
              const daysSincePayment = Math.ceil((today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSincePayment > 30) {
                // Payment is old, might be late for next payment
                paymentStatus = 'pending';
              }
            } else if (latestPayment.status === 'pending') {
              // Check how many days since payment was created
              const daysSinceCreated = Math.ceil((today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceCreated > 0) {
                paymentStatus = 'late';
                daysLate = daysSinceCreated;
              } else {
                paymentStatus = 'pending';
              }
            } else {
              paymentStatus = 'pending';
            }
          } else {
            // No payment found, check if rent is due based on lease start date
            const startDate = new Date(currentLease.start_date);
            const today = new Date();
            const daysSinceStart = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // If lease started more than 0 days ago, payment might be pending
            if (daysSinceStart > 0) {
              paymentStatus = 'pending';
              // If more than 15 days, consider it late
              if (daysSinceStart > 15) {
                paymentStatus = 'late';
                daysLate = daysSinceStart;
              }
            }
          }
        }

        return {
          id: tenant.id,
          unitId,
          firstName: tenant.first_name,
          lastName: tenant.last_name,
          email: tenant.email,
          phone: tenant.phone,
          idNumber: tenant.id_number,
          unitNumber,
          propertyName,
          rentAmount,
          leaseStatus,
          leaseEndDate,
          paymentStatus,
          daysLate,
          lastPaymentDate,
          hasExtranetAccess: tenant.has_extranet_access || false,
          language: tenant.language || 'fr',
          createdAt: tenant.created_at,
        };
      })
    );

    return NextResponse.json(tenantsWithDetails);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenants
 * Create a new tenant
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

    // Check profile permissions for Tenant creation
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (userRecord?.profile_id) {
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const tenantPermission = objectPermissions.find(p => p.objectType === 'Tenant');
      const canCreateTenants = tenantPermission?.canCreate || false;

      if (!canCreateTenants) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to create tenants' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const validatedData = createTenantSchema.parse(body);

    // Verify unit belongs to organization
    const unit = await db.selectOne<{
      id: string;
      organization_id: string;
      unit_number: string;
    }>('units', {
      eq: { id: validatedData.unitId },
    });

    if (!unit || unit.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Unit not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Check if unit already has a tenant
    const existingTenant = await db.selectOne('tenants', {
      eq: { unit_id: validatedData.unitId },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: 'This unit already has a tenant' },
        { status: 400 }
      );
    }

    // Create tenant
    const newTenant = await db.insertOne<{
      id: string;
      organization_id: string;
      unit_id: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      email: string | null;
      id_number: string | null;
      has_extranet_access: boolean;
      language: string;
      created_at: Date | string;
    }>('tenants', {
      organization_id: user.organizationId,
      unit_id: validatedData.unitId,
      first_name: validatedData.firstName,
      last_name: validatedData.lastName,
      phone: validatedData.phone || null,
      email: validatedData.email || null,
      id_number: validatedData.idNumber || null,
      has_extranet_access: validatedData.hasExtranetAccess,
      language: validatedData.language,
    });

    if (!newTenant) {
      return NextResponse.json(
        { error: 'Failed to create tenant' },
        { status: 500 }
      );
    }

    // Update unit status to occupied
    await db.update('units', { status: 'occupied' }, { id: validatedData.unitId });

    // Log activity
    const requestHeaders = await headers();
    const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
    await logEntityCreated(
      user.organizationId,
      'tenant',
      newTenant.id,
      user.id,
      `${validatedData.firstName} ${validatedData.lastName}`,
      {
        unitId: validatedData.unitId,
        unitNumber: unit.unit_number,
        phone: validatedData.phone,
        email: validatedData.email,
        hasExtranetAccess: validatedData.hasExtranetAccess,
        ipAddress,
        userAgent,
      }
    );

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: newTenant.id,
      organizationId: newTenant.organization_id,
      unitId: newTenant.unit_id,
      firstName: newTenant.first_name,
      lastName: newTenant.last_name,
      phone: newTenant.phone,
      email: newTenant.email,
      idNumber: newTenant.id_number,
      hasExtranetAccess: newTenant.has_extranet_access,
      language: newTenant.language,
      createdAt: newTenant.created_at,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

