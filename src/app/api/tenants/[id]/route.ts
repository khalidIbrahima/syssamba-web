import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { logEntityUpdated, logEntityDeleted, getRequestMetadata } from '@/lib/activity-tracker';
import { z } from 'zod';

const updateTenantSchema = z.object({
  unitId: z.string().min(1).optional(),
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  idNumber: z.string().optional(),
  hasExtranetAccess: z.boolean().optional(),
  language: z.enum(['fr', 'en', 'wo']).optional(),
});

/**
 * GET /api/tenants/[id]
 * Get a single tenant by ID
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

    const tenant = await db.selectOne<{
      id: string;
      organization_id: string;
      unit_id: string | null;
      first_name: string;
      last_name: string;
      phone: string | null;
      email: string | null;
      id_number: string | null;
      has_extranet_access: boolean;
      language: string;
      created_at: Date | string;
    }>('tenants', {
      eq: { id },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Verify tenant belongs to user's organization
    if (tenant.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get unit and property details
    let unitNumber = 'N/A';
    let propertyName = 'N/A';
    let propertyId = null;

    if (tenant.unit_id) {
      const unit = await db.selectOne<{
        id: string;
        unit_number: string;
        property_id: string | null;
      }>('units', {
        eq: { id: tenant.unit_id },
      });

      if (unit) {
        unitNumber = unit.unit_number || 'N/A';

        if (unit.property_id) {
          propertyId = unit.property_id;
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

    // Get lease information
    let leaseInfo = null;
    if (tenant.id) {
      const leaseRecords = await db.select<{
        id: string;
        tenant_id: string;
        start_date: Date | string;
        end_date: Date | string | null;
        rent_amount: string | null;
        deposit_paid: boolean;
        signed: boolean;
      }>('leases', {
        eq: { tenant_id: tenant.id },
        orderBy: { column: 'created_at', ascending: true },
        limit: 1,
      });
      
      leaseInfo = leaseRecords[0] || null;
    }

    // Get payment history (last 10 payments)
    let paymentHistory: any[] = [];
    if (tenant.id) {
      const paymentRecords = await db.select<{
        id: string;
        amount: string;
        status: string;
        paid_at: Date | string | null;
        created_at: Date | string;
      }>('payments', {
        eq: { tenant_id: tenant.id },
        orderBy: { column: 'created_at', ascending: false },
        limit: 10,
      });
      
      paymentHistory = paymentRecords.map((p) => ({
        id: p.id,
        amount: parseFloat(p.amount || '0'),
        status: p.status,
        paidAt: p.paid_at,
        createdAt: p.created_at,
      }));
    }

    // Get unit details for rent amount
    let rentAmount = 0;
    let chargesAmount = 0;
    let depositAmount = 0;
    if (tenant.unit_id) {
      const unit = await db.selectOne<{
        id: string;
        rent_amount: string;
        charges_amount: string;
        deposit_amount: string;
      }>('units', {
        eq: { id: tenant.unit_id },
      });
      
      if (unit) {
        rentAmount = parseFloat(unit.rent_amount || '0');
        chargesAmount = parseFloat(unit.charges_amount || '0');
        depositAmount = parseFloat(unit.deposit_amount || '0');
      }
    }

    return NextResponse.json({
      id: tenant.id,
      organizationId: tenant.organization_id,
      unitId: tenant.unit_id,
      firstName: tenant.first_name,
      lastName: tenant.last_name,
      phone: tenant.phone,
      email: tenant.email,
      idNumber: tenant.id_number,
      hasExtranetAccess: tenant.has_extranet_access || false,
      language: tenant.language || 'fr',
      unitNumber,
      propertyName,
      propertyId,
      rentAmount,
      chargesAmount,
      depositAmount,
      lease: leaseInfo ? {
        id: leaseInfo.id,
        startDate: leaseInfo.start_date,
        endDate: leaseInfo.end_date,
        rentAmount: leaseInfo.rent_amount ? parseFloat(leaseInfo.rent_amount) : null,
        depositPaid: leaseInfo.deposit_paid,
        signed: leaseInfo.signed,
      } : null,
      paymentHistory,
      createdAt: tenant.created_at,
    });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tenants/[id]
 * Update a tenant
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
    const validatedData = updateTenantSchema.parse(body);

    // Verify tenant exists and belongs to organization
    const tenant = await db.selectOne<{
      id: string;
      organization_id: string;
      unit_id: string | null;
      first_name: string;
      last_name: string;
      phone: string | null;
      email: string | null;
      id_number: string | null;
      has_extranet_access: boolean;
      language: string;
    }>('tenants', {
      eq: { id },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    if (tenant.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // If unitId is being updated, verify the new unit belongs to organization
    if (validatedData.unitId && validatedData.unitId !== tenant.unit_id) {
      const unit = await db.selectOne<{
        id: string;
        organization_id: string;
      }>('units', {
        eq: { id: validatedData.unitId },
      });

      if (!unit || unit.organization_id !== user.organizationId) {
        return NextResponse.json(
          { error: 'Unit not found or does not belong to your organization' },
          { status: 404 }
        );
      }

      // Check if new unit already has a tenant
      const existingTenant = await db.selectOne('tenants', {
        eq: { unit_id: validatedData.unitId },
      });

      if (existingTenant && existingTenant.id !== id) {
        return NextResponse.json(
          { error: 'This unit already has a tenant' },
          { status: 400 }
        );
      }

      // Update old unit status to vacant if it had this tenant
      if (tenant.unit_id) {
        await db.update('units', { status: 'vacant' }, { id: tenant.unit_id });
      }

      // Update new unit status to occupied
      await db.update('units', { status: 'occupied' }, { id: validatedData.unitId });
    }

    // Track changes before update
    const changes: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = [];
    
    // Build update object (using snake_case for database)
    const updateData: any = {};
    if (validatedData.unitId !== undefined && validatedData.unitId !== tenant.unit_id) {
      changes.push({
        fieldName: 'unitId',
        oldValue: tenant.unit_id || null,
        newValue: validatedData.unitId,
      });
      updateData.unit_id = validatedData.unitId;
    }
    if (validatedData.firstName !== undefined && validatedData.firstName !== tenant.first_name) {
      changes.push({
        fieldName: 'firstName',
        oldValue: tenant.first_name || null,
        newValue: validatedData.firstName,
      });
      updateData.first_name = validatedData.firstName;
    }
    if (validatedData.lastName !== undefined && validatedData.lastName !== tenant.last_name) {
      changes.push({
        fieldName: 'lastName',
        oldValue: tenant.last_name || null,
        newValue: validatedData.lastName,
      });
      updateData.last_name = validatedData.lastName;
    }
    if (validatedData.phone !== undefined && validatedData.phone !== tenant.phone) {
      changes.push({
        fieldName: 'phone',
        oldValue: tenant.phone || null,
        newValue: validatedData.phone || null,
      });
      updateData.phone = validatedData.phone || null;
    }
    if (validatedData.email !== undefined && validatedData.email !== tenant.email) {
      changes.push({
        fieldName: 'email',
        oldValue: tenant.email || null,
        newValue: validatedData.email || null,
      });
      updateData.email = validatedData.email || null;
    }
    if (validatedData.idNumber !== undefined && validatedData.idNumber !== tenant.id_number) {
      changes.push({
        fieldName: 'idNumber',
        oldValue: tenant.id_number || null,
        newValue: validatedData.idNumber || null,
      });
      updateData.id_number = validatedData.idNumber || null;
    }
    if (validatedData.hasExtranetAccess !== undefined && validatedData.hasExtranetAccess !== tenant.has_extranet_access) {
      changes.push({
        fieldName: 'hasExtranetAccess',
        oldValue: tenant.has_extranet_access ? 'true' : 'false',
        newValue: validatedData.hasExtranetAccess ? 'true' : 'false',
      });
      updateData.has_extranet_access = validatedData.hasExtranetAccess;
    }
    if (validatedData.language !== undefined && validatedData.language !== tenant.language) {
      changes.push({
        fieldName: 'language',
        oldValue: tenant.language || null,
        newValue: validatedData.language,
      });
      updateData.language = validatedData.language;
    }

    // Update tenant
    const updatedTenant = await db.updateOne<{
      id: string;
      organization_id: string;
      unit_id: string | null;
      first_name: string;
      last_name: string;
      phone: string | null;
      email: string | null;
      id_number: string | null;
      has_extranet_access: boolean;
      language: string;
      created_at: Date | string;
    }>('tenants', updateData, { id });

    if (!updatedTenant) {
      return NextResponse.json(
        { error: 'Failed to update tenant' },
        { status: 500 }
      );
    }

    // Log activity if there are changes
    if (changes.length > 0) {
      const requestHeaders = await headers();
      const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
      const tenantName = `${tenant.first_name} ${tenant.last_name}`;
      await logEntityUpdated(
        user.organizationId,
        'tenant',
        id,
        user.id,
        changes,
        tenantName,
        { ipAddress, userAgent }
      );
    }

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: updatedTenant.id,
      organizationId: updatedTenant.organization_id,
      unitId: updatedTenant.unit_id,
      firstName: updatedTenant.first_name,
      lastName: updatedTenant.last_name,
      phone: updatedTenant.phone,
      email: updatedTenant.email,
      idNumber: updatedTenant.id_number,
      hasExtranetAccess: updatedTenant.has_extranet_access,
      language: updatedTenant.language,
      createdAt: updatedTenant.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating tenant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenants/[id]
 * Delete a tenant
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

    // Verify tenant exists and belongs to organization
    const tenant = await db.selectOne<{
      id: string;
      organization_id: string;
      unit_id: string | null;
      first_name: string;
      last_name: string;
    }>('tenants', {
      eq: { id },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    if (tenant.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update unit status to vacant
    if (tenant.unit_id) {
      await db.update('units', { status: 'vacant' }, { id: tenant.unit_id });
    }

    // Log activity before deletion
    const requestHeaders = await headers();
    const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
    const tenantName = `${tenant.first_name} ${tenant.last_name}`;
    await logEntityDeleted(
      user.organizationId,
      'tenant',
      id,
      user.id,
      tenantName,
      {
        unitId: tenant.unit_id,
        ipAddress,
        userAgent,
      }
    );

    // Delete tenant
    await db.delete('tenants', { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

