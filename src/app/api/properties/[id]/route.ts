import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { logEntityUpdated, getRequestMetadata } from '@/lib/activity-tracker';
import { z } from 'zod';

const updatePropertySchema = z.object({
  name: z.string().min(3).optional(),
  address: z.string().min(5).optional(),
  city: z.string().min(2).optional(),
  propertyType: z.string().min(1).optional(),
  totalUnits: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

/**
 * GET /api/properties/[id]
 * Get a single property by ID
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
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Get property using Supabase
    const property = await db.selectOne<{
      id: string;
      organization_id: string;
      name: string;
      address: string;
      city: string | null;
      property_type: string | null;
      total_units: number | null;
      photo_urls: string[] | null;
      notes: string | null;
      latitude: string | null;
      longitude: string | null;
      created_at: Date | string;
    }>('properties', {
      eq: { id },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Verify property belongs to user's organization
    if (property.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get units for this property
    const propertyUnits = await db.select<{
      id: string;
      status: string;
      rent_amount: string | null;
      charges_amount: string | null;
    }>('units', {
      eq: { property_id: id },
    });

    const totalUnits = propertyUnits.length;
    const occupiedUnits = propertyUnits.filter(u => u.status === 'occupied').length;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    // Calculate monthly revenue
    const monthlyRevenue = propertyUnits
      .filter(u => u.status === 'occupied')
      .reduce((sum, unit) => {
        const rent = parseFloat(unit.rent_amount || '0');
        const charges = parseFloat(unit.charges_amount || '0');
        return sum + rent + charges;
      }, 0);

    // Format photos
    const photos = (property.photo_urls || []).map((url, index) => ({
      id: `${id}-photo-${index}`,
      url,
      alt: `Photo ${index + 1} de ${property.name}`,
    }));

    // Get property stats (simplified - in production, calculate from actual data)
    const stats = {
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      monthlyRevenue: Math.round(monthlyRevenue),
      annualYield: 0, // Would need acquisition value to calculate
      currentValue: 0, // Would need appraisal data
      outstandingPayments: 0, // Would need payment tracking
    };

    // General info (simplified - would need additional fields in schema)
    const generalInfo = {
      propertyType: property.property_type || 'Non spécifié',
      constructionYear: null,
      floors: null,
      totalSurface: null,
      hasElevator: null,
      parkingSpaces: null,
      propertyManager: null,
    };

    // Title info (simplified - would need additional fields)
    const title = {
      landTitleNumber: 'Non spécifié',
      acquisitionDate: null,
      totalSurface: null,
      acquisitionValue: null,
      documentUrl: null,
    };

    // Owners (simplified - would need owners table)
    const owners: any[] = [];

    // Diagnostics (simplified - would need diagnostics table)
    const diagnostics: any[] = [];

    // Recent activity (simplified - would need activity log)
    const recentActivity: any[] = [];

    return NextResponse.json({
      id: property.id,
      name: property.name,
      address: property.address,
      city: property.city,
      totalUnits,
      occupiedUnits,
      acquisitionDate: null,
      acquisitionYear: null,
      photos,
      stats,
      generalInfo,
      title,
      owners,
      diagnostics,
      recentActivity,
      notes: property.notes,
      latitude: property.latitude ? parseFloat(property.latitude) : null,
      longitude: property.longitude ? parseFloat(property.longitude) : null,
      createdAt: property.created_at,
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/properties/[id]
 * Update a property
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
    
    if (!id) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Check if property exists and belongs to user's organization
    const property = await db.selectOne<{
      id: string;
      organization_id: string;
      name: string;
      [key: string]: any;
    }>('properties', {
      eq: { id },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    if (property.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validatedData = updatePropertySchema.parse(body);

    // Map camelCase to snake_case for database
    const updateData: Record<string, any> = {};
    
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.address !== undefined) updateData.address = validatedData.address;
    if (validatedData.city !== undefined) updateData.city = validatedData.city;
    if (validatedData.propertyType !== undefined) updateData.property_type = validatedData.propertyType;
    if (validatedData.totalUnits !== undefined) updateData.total_units = validatedData.totalUnits;
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;
    if (validatedData.photoUrls !== undefined) updateData.photo_urls = validatedData.photoUrls;
    
    // Convert latitude/longitude to strings if provided
    if (validatedData.latitude !== undefined) {
      updateData.latitude = validatedData.latitude?.toString() || null;
    }
    if (validatedData.longitude !== undefined) {
      updateData.longitude = validatedData.longitude?.toString() || null;
    }
    
    // Track changes before update
    const changes: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = [];
    
    Object.keys(validatedData).forEach((key) => {
      const dbKey = key === 'propertyType' ? 'property_type' : 
                    key === 'totalUnits' ? 'total_units' :
                    key === 'photoUrls' ? 'photo_urls' : key;
      const oldValue = property[dbKey];
      const newValue = validatedData[key as keyof typeof validatedData];
      
      if (oldValue !== newValue) {
        changes.push({
          fieldName: key,
          oldValue: oldValue ? String(oldValue) : null,
          newValue: newValue ? String(newValue) : null,
        });
      }
    });

    // Check if updateData is not empty
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updatedProperty = await db.updateOne<{
      id: string;
      name: string;
      address: string;
      city: string | null;
      property_type: string | null;
      total_units: number | null;
      notes: string | null;
      photo_urls: string[] | null;
      latitude: string | null;
      longitude: string | null;
      created_at: Date | string;
    }>('properties', updateData, { id });

    if (!updatedProperty) {
      return NextResponse.json(
        { error: 'Property not found or update failed' },
        { status: 404 }
      );
    }

    // Log activity if there are changes
    if (changes.length > 0) {
      const requestHeaders = await headers();
      const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
      await logEntityUpdated(
        user.organizationId,
        'property',
        id,
        user.id,
        changes,
        property.name,
        {
          ipAddress,
          userAgent,
        }
      );
    }

    // Map snake_case to camelCase for response
    return NextResponse.json({
      id: updatedProperty.id,
      name: updatedProperty.name,
      address: updatedProperty.address,
      city: updatedProperty.city,
      propertyType: updatedProperty.property_type,
      totalUnits: updatedProperty.total_units,
      notes: updatedProperty.notes,
      photoUrls: updatedProperty.photo_urls || [],
      latitude: updatedProperty.latitude ? parseFloat(updatedProperty.latitude) : null,
      longitude: updatedProperty.longitude ? parseFloat(updatedProperty.longitude) : null,
      createdAt: updatedProperty.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating property:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

