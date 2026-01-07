import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { logEntityUpdated, logStatusChanged, getRequestMetadata } from '@/lib/activity-tracker';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { z } from 'zod';

const updateUnitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  propertyId: z.string().min(1).optional(),
  unitType: z.string().optional(), // Can be standard type or custom type slug
  floor: z.string().optional(),
  surface: z.number().int().min(1).optional(),
  rentAmount: z.number().min(0).optional(),
  chargesAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  status: z.enum(['vacant', 'occupied', 'maintenance', 'reserved']).optional(),
  photoUrls: z.array(z.string()).optional(),
});

/**
 * GET /api/units/[id]
 * Get a single unit by ID
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
        { error: 'Unit ID is required' },
        { status: 400 }
      );
    }

    // Get unit using Supabase
    const unit = await db.selectOne<{
      id: string;
      organization_id: string;
      property_id: string | null;
      unit_number: string;
      unit_type: string | null;
      floor: string | null;
      surface: number | null;
      rent_amount: string | null;
      charges_amount: string | null;
      deposit_amount: string | null;
      status: string;
      photo_urls: string[] | null;
      amenities: string[] | null;
      created_at: Date | string;
    }>('units', {
      eq: { id },
    });

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    // Verify unit belongs to user's organization
    if (unit.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get property information
    const property = unit.property_id ? await db.selectOne<{
      id: string;
      name: string;
      address: string;
      city: string;
      latitude: string | null;
      longitude: string | null;
    }>('properties', {
      eq: { id: unit.property_id },
    }) : null;

    // Get current tenant
    const tenant = await db.selectOne<{
      id: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      email: string | null;
      has_extranet_access: boolean;
      created_at: Date | string;
    }>('tenants', {
      eq: { unit_id: id },
    });

    // Get current lease (most recent active lease)
    const leases = await db.select('leases', {
      eq: { unit_id: id },
    });

    // Sort by start_date descending and get the first one
    const sortedLeases = leases.sort((a: any, b: any) => {
      const dateA = new Date(a.start_date).getTime();
      const dateB = new Date(b.start_date).getTime();
      return dateB - dateA;
    });

    const lease = sortedLeases && sortedLeases.length > 0 ? sortedLeases[0] : null;

    // Get recent payments
    const allPayments = await db.select('payments', {
      eq: { unit_id: id },
    });

    // Sort by created_at descending and get the first 5
    const sortedPayments = allPayments.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    const paymentRecords = sortedPayments.slice(0, 5);

    // Format photos
    const photos = ((unit.photo_urls || []) as string[]).map((url, index) => ({
      id: `${unit.id}-photo-${index}`,
      url,
      alt: `Photo ${index + 1} de ${unit.unit_number}`,
    }));

    // Get owner (would need owners table - for now, use property owner or organization)
    const owner = null; // TODO: Implement owners table

    return NextResponse.json({
      id: unit.id,
      unitNumber: unit.unit_number,
      unitType: unit.unit_type,
      property: property ? {
        id: property.id,
        name: property.name,
        address: property.address,
        city: property.city,
        latitude: property.latitude ? parseFloat(property.latitude) : null,
        longitude: property.longitude ? parseFloat(property.longitude) : null,
      } : null,
      floor: unit.floor,
      surface: unit.surface,
      rentAmount: parseFloat(unit.rent_amount || '0'),
      chargesAmount: parseFloat(unit.charges_amount || '0'),
      depositAmount: parseFloat(unit.deposit_amount || '0'),
      status: unit.status,
      photos,
      amenities: unit.amenities || [],
      tenant: tenant ? {
        id: tenant.id,
        firstName: tenant.first_name,
        lastName: tenant.last_name,
        phone: tenant.phone,
        email: tenant.email,
        hasExtranetAccess: tenant.has_extranet_access,
        createdAt: tenant.created_at,
      } : null,
      lease: lease ? {
        id: lease.id,
        startDate: lease.start_date,
        endDate: lease.end_date,
        rentAmount: lease.rent_amount ? parseFloat(lease.rent_amount) : null,
        signed: lease.signed,
      } : null,
      recentPayments: paymentRecords.map(p => ({
        id: p.id,
        amount: parseFloat(p.amount || '0'),
        status: p.status,
        paidAt: p.paid_at,
        createdAt: p.created_at,
      })),
      owner,
      createdAt: unit.created_at,
    });
  } catch (error) {
    console.error('Error fetching unit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/units/[id]
 * Update a unit
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

    // Check profile permissions for Unit edit
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (userRecord?.profile_id) {
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const unitPermission = objectPermissions.find(p => p.objectType === 'Unit');
      const canEditUnits = unitPermission?.canEdit || false;

      if (!canEditUnits) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to edit units' },
          { status: 403 }
        );
      }
    }

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Unit ID is required' },
        { status: 400 }
      );
    }
    // Check if unit exists and belongs to user's organization
    const unit = await db.selectOne<{
      id: string;
      organization_id: string;
      unit_number: string;
      unit_type: string | null;
      property_id: string | null;
      floor: string | null;
      surface: number | null;
      rent_amount: string | null;
      charges_amount: string | null;
      deposit_amount: string | null;
      status: string;
      photo_urls: string[] | null;
    }>('units', {
      eq: { id },
    });

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    if (unit.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validatedData = updateUnitSchema.parse(body);

    // Track changes before update
    const changes: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = [];
    const oldStatus = unit.status;
    
    // Prepare update data (snake_case for database)
    const updateData: any = {};
    if (validatedData.unitNumber !== undefined) {
      if (unit.unit_number !== validatedData.unitNumber) {
        changes.push({
          fieldName: 'unitNumber',
          oldValue: unit.unit_number || null,
          newValue: validatedData.unitNumber,
        });
      }
      updateData.unit_number = validatedData.unitNumber;
    }
    if (validatedData.propertyId !== undefined) {
      if (unit.property_id !== validatedData.propertyId) {
        changes.push({
          fieldName: 'propertyId',
          oldValue: unit.property_id || null,
          newValue: validatedData.propertyId,
        });
      }
      updateData.property_id = validatedData.propertyId;
    }
    if (validatedData.unitType !== undefined) {
      if (unit.unit_type !== validatedData.unitType) {
        changes.push({
          fieldName: 'unitType',
          oldValue: unit.unit_type || null,
          newValue: validatedData.unitType || null,
        });
      }
      updateData.unit_type = validatedData.unitType || null;
    }
    if (validatedData.floor !== undefined) {
      if (unit.floor !== validatedData.floor) {
        changes.push({
          fieldName: 'floor',
          oldValue: unit.floor || null,
          newValue: validatedData.floor || null,
        });
      }
      updateData.floor = validatedData.floor || null;
    }
    if (validatedData.surface !== undefined) {
      if (unit.surface !== validatedData.surface) {
        changes.push({
          fieldName: 'surface',
          oldValue: unit.surface ? String(unit.surface) : null,
          newValue: validatedData.surface ? String(validatedData.surface) : null,
        });
      }
      updateData.surface = validatedData.surface || null;
    }
    if (validatedData.rentAmount !== undefined) {
      const newRent = validatedData.rentAmount.toString();
      if (unit.rent_amount !== newRent) {
        changes.push({
          fieldName: 'rentAmount',
          oldValue: unit.rent_amount || null,
          newValue: newRent,
        });
      }
      updateData.rent_amount = newRent;
    }
    if (validatedData.chargesAmount !== undefined) {
      const newCharges = validatedData.chargesAmount.toString();
      if (unit.charges_amount !== newCharges) {
        changes.push({
          fieldName: 'chargesAmount',
          oldValue: unit.charges_amount || null,
          newValue: newCharges,
        });
      }
      updateData.charges_amount = newCharges;
    }
    if (validatedData.depositAmount !== undefined) {
      const newDeposit = validatedData.depositAmount.toString();
      if (unit.deposit_amount !== newDeposit) {
        changes.push({
          fieldName: 'depositAmount',
          oldValue: unit.deposit_amount || null,
          newValue: newDeposit,
        });
      }
      updateData.deposit_amount = newDeposit;
    }
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }
    if (validatedData.photoUrls !== undefined) {
      const oldPhotos = JSON.stringify(unit.photo_urls || []);
      const newPhotos = JSON.stringify(validatedData.photoUrls || []);
      if (oldPhotos !== newPhotos) {
        changes.push({
          fieldName: 'photoUrls',
          oldValue: oldPhotos,
          newValue: newPhotos,
        });
      }
      updateData.photo_urls = validatedData.photoUrls;
    }

    // Update unit using Supabase
    const updatedUnit = await db.updateOne('units', updateData, {
      eq: { id },
    });

    // Log activities
    const requestHeaders = await headers();
    const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
    
    // Log status change separately if status changed
    if (validatedData.status !== undefined && validatedData.status !== oldStatus) {
      await logStatusChanged(
        user.organizationId,
        'unit',
        id,
        user.id,
        oldStatus,
        validatedData.status,
        unit.unit_number,
        { ipAddress, userAgent }
      );
    }
    
    // Log other changes
    if (changes.length > 0) {
      await logEntityUpdated(
        user.organizationId,
        'unit',
        id,
        user.id,
        changes,
        unit.unit_number,
        { ipAddress, userAgent }
      );
    }

    return NextResponse.json(updatedUnit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating unit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

