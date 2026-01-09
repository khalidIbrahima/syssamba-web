import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { logEntityCreated, getRequestMetadata } from '@/lib/activity-tracker';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { z } from 'zod';

const createUnitSchema = z.object({
  unitNumber: z.string().min(1),
  propertyId: z.string().min(1),
  unitType: z.string().optional(), // Can be standard type or custom type slug
  floor: z.string().optional(),
  surface: z.number().int().min(1).optional(),
  rentAmount: z.number().min(0).default(0),
  chargesAmount: z.number().min(0).default(0),
  depositAmount: z.number().min(0).default(0),
  status: z.enum(['vacant', 'occupied', 'maintenance', 'reserved']).default('vacant'),
  photoUrls: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
});

/**
 * POST /api/units
 * Create a new unit
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

    // Check profile permissions for Unit creation
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (userRecord?.profile_id) {
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const unitPermission = objectPermissions.find(p => p.objectType === 'Unit');
      const canCreateUnits = unitPermission?.canCreate || false;

      if (!canCreateUnits) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to create units' },
          { status: 403 }
        );
      }
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validatedData = createUnitSchema.parse(body);

    // Verify property belongs to organization
    const property = await db.selectOne<{
      id: string;
      organization_id: string;
      name: string;
    }>('properties', {
      eq: { id: validatedData.propertyId },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    if (property.organization_id !== organization.id) {
      return NextResponse.json(
        { error: 'Property does not belong to your organization' },
        { status: 403 }
      );
    }

    // Check lots limit from subscription/plan
    const { getOrganizationPlanLimits } = await import('@/lib/permissions');
    const { lotsLimit } = await getOrganizationPlanLimits(organization.id);

    const currentCount = await db.count('units', {
      organization_id: organization.id,
    });

    // Check if adding one more unit would exceed the limit
    if (lotsLimit !== null && currentCount >= lotsLimit) {
      return NextResponse.json(
        { 
          error: `Limite de lots atteinte. Vous avez ${currentCount} lots et la limite de votre plan est de ${lotsLimit}. Veuillez mettre à niveau votre plan pour créer plus de lots.`,
          limitReached: true,
          currentCount,
          limit: lotsLimit,
        },
        { status: 403 }
      );
    }

    // Create unit
    const newUnit = await db.insertOne<{
      id: string;
      organization_id: string;
      property_id: string;
      unit_number: string;
      unit_type: string | null;
      floor: string | null;
      surface: number | null;
      rent_amount: string;
      charges_amount: string;
      deposit_amount: string;
      status: string;
      photo_urls: string[] | null;
      amenities: string[] | null;
      created_at: Date | string;
    }>('units', {
      organization_id: organization.id,
      property_id: validatedData.propertyId,
      unit_number: validatedData.unitNumber,
      unit_type: validatedData.unitType || null,
      floor: validatedData.floor || null,
      surface: validatedData.surface || null,
      rent_amount: validatedData.rentAmount.toString(),
      charges_amount: validatedData.chargesAmount.toString(),
      deposit_amount: validatedData.depositAmount.toString(),
      status: validatedData.status,
      photo_urls: validatedData.photoUrls || [],
      amenities: validatedData.amenities || [],
    });

    if (!newUnit) {
      return NextResponse.json(
        { error: 'Failed to create unit' },
        { status: 500 }
      );
    }

    // Log activity
    const requestHeaders = await headers();
    const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
    await logEntityCreated(
      organization.id,
      'unit',
      newUnit.id,
      user.id,
      validatedData.unitNumber,
      {
        propertyId: validatedData.propertyId,
        propertyName: property.name,
        status: validatedData.status,
        rentAmount: validatedData.rentAmount,
        ipAddress,
        userAgent,
      }
    );

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: newUnit.id,
      organizationId: newUnit.organization_id,
      propertyId: newUnit.property_id,
      unitNumber: newUnit.unit_number,
      floor: newUnit.floor,
      surface: newUnit.surface,
      rentAmount: newUnit.rent_amount,
      chargesAmount: newUnit.charges_amount,
      depositAmount: newUnit.deposit_amount,
      status: newUnit.status,
      photoUrls: newUnit.photo_urls,
      amenities: newUnit.amenities || [],
      createdAt: newUnit.created_at,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating unit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/units
 * Get all units for the current organization
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

    // Check profile permissions for Unit read
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (userRecord?.profile_id) {
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const unitPermission = objectPermissions.find(p => p.objectType === 'Unit');
      const canReadUnits = unitPermission?.canRead || false;

      if (!canReadUnits) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view units' },
          { status: 403 }
        );
      }
    }

    const unitsList = await db.select<{
      id: string;
      organization_id: string;
      property_id: string | null;
      unit_number: string;
      floor: string | null;
      surface: number | null;
      rent_amount: string;
      charges_amount: string;
      deposit_amount: string;
      status: string;
      photo_urls: string[] | null;
      amenities: string[] | null;
      created_at: Date | string;
    }>('units', {
      eq: { organization_id: user.organizationId },
      orderBy: { column: 'created_at', ascending: false },
    });
    
    const unitsWithDetails = await Promise.all(
      unitsList.map(async (unit) => {
        // Get property
        const property = unit.property_id ? await db.selectOne<{
          id: string;
          name: string;
          city: string | null;
          address: string;
          latitude: string | null;
          longitude: string | null;
        }>('properties', {
          eq: { id: unit.property_id },
        }) : null;
        
        // Get tenant for this unit
        const tenant = await db.selectOne<{
          id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
        }>('tenants', {
          eq: { unit_id: unit.id },
        });

        // Check payment status - get most recent payment for this unit
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const paymentRecords = await db.select<{
          id: string;
          status: string;
          paid_at: Date | string | null;
        }>('payments', {
          eq: { unit_id: unit.id },
          orderBy: { column: 'created_at', ascending: true },
          limit: 1,
        });

        const recentPayment = paymentRecords[0];
        const isPaid = recentPayment && recentPayment.status === 'completed' && recentPayment.paid_at && new Date(recentPayment.paid_at) >= startOfMonth;

        return {
          id: unit.id,
          unitNumber: unit.unit_number,
          propertyId: unit.property_id,
          propertyName: property?.name || 'Propriété inconnue',
          propertyCity: property?.city || null,
          propertyAddress: property?.address || null,
          propertyLatitude: property?.latitude || null,
          propertyLongitude: property?.longitude || null,
          floor: unit.floor,
          surface: unit.surface,
          rentAmount: parseFloat(unit.rent_amount || '0'),
          chargesAmount: parseFloat(unit.charges_amount || '0'),
          depositAmount: parseFloat(unit.deposit_amount || '0'),
          status: unit.status,
          tenantName: tenant ? `${tenant.first_name} ${tenant.last_name}` : null,
          tenantPhone: tenant?.phone || null,
          tenantEmail: tenant?.email || null,
          paymentStatus: isPaid ? 'paid' : (unit.status === 'occupied' ? 'unpaid' : null),
          photoUrls: unit.photo_urls || [],
          amenities: unit.amenities || [],
          createdAt: unit.created_at,
        };
      })
    );

    return NextResponse.json(unitsWithDetails);
  } catch (error) {
    console.error('Error fetching units:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

