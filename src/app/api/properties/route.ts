import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { logEntityCreated, getRequestMetadata } from '@/lib/activity-tracker';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { getEnabledPlanFeatures } from '@/lib/plan-features';
import { z } from 'zod';

const createPropertySchema = z.object({
  name: z.string().min(3),
  address: z.string().min(5),
  city: z.string().min(2),
  propertyType: z.string().min(1),
  totalUnits: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

/**
 * POST /api/properties
 * Create a new property
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

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validatedData = createPropertySchema.parse(body);

    // Check lots limit if totalUnits is provided
    if (validatedData.totalUnits) {
      // Get plan limits from subscription/plan
      const subscriptions = await db.select<{ plan_id: string }>('subscriptions', {
        eq: { organization_id: organization.id },
        orderBy: { column: 'created_at', ascending: true },
        limit: 1,
      });
      const subscription = subscriptions[0];

      let lotsLimit: number | null = null;
      if (subscription?.plan_id) {
        const plan = await db.selectOne<{ lots_limit: number | null }>('plans', {
          eq: { id: subscription.plan_id },
        });
        
        lotsLimit = plan?.lots_limit ?? null;
      }

      // Get current usage
      const currentCount = await db.count('units', {
        organization_id: organization.id,
      });

      if (lotsLimit !== null && currentCount + validatedData.totalUnits > lotsLimit) {
        return NextResponse.json(
          { 
            error: `Limite de lots dépassée. Vous avez ${currentCount} lots et la limite est de ${lotsLimit}. Vous ne pouvez pas ajouter ${validatedData.totalUnits} lots supplémentaires.`,
          },
          { status: 400 }
        );
      }
    }

    // Create property
    const newProperty = await db.insertOne<{
      id: string;
      organization_id: string;
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
    }>('properties', {
      organization_id: organization.id,
        name: validatedData.name,
        address: validatedData.address,
        city: validatedData.city,
      property_type: validatedData.propertyType,
      total_units: validatedData.totalUnits || null,
        notes: validatedData.notes || null,
      photo_urls: validatedData.photoUrls || [],
        latitude: validatedData.latitude?.toString() || null,
        longitude: validatedData.longitude?.toString() || null,
    });

    if (!newProperty) {
      return NextResponse.json(
        { error: 'Failed to create property' },
        { status: 500 }
      );
    }

    // Log activity
    const requestHeaders = await headers();
    const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
    await logEntityCreated(
      organization.id,
      'property',
      newProperty.id,
      user.id,
      validatedData.name,
      {
        address: validatedData.address,
        city: validatedData.city,
        propertyType: validatedData.propertyType,
        totalUnits: validatedData.totalUnits,
        ipAddress,
        userAgent,
      }
    );

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: newProperty.id,
      organizationId: newProperty.organization_id,
      name: newProperty.name,
      address: newProperty.address,
      city: newProperty.city,
      propertyType: newProperty.property_type,
      totalUnits: newProperty.total_units,
      notes: newProperty.notes,
      photoUrls: newProperty.photo_urls,
      latitude: newProperty.latitude,
      longitude: newProperty.longitude,
      createdAt: newProperty.created_at,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating property:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/properties
 * Get all properties for the current organization
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

    // Check plan feature - TODO: Get actual plan from organization subscription
    const planFeatures = await getEnabledPlanFeatures('freemium');
    if (!planFeatures.has('properties_management')) {
      return NextResponse.json(
        { error: 'Forbidden: Properties feature is not available in your plan' },
        { status: 403 }
      );
    }

    // Get user profile permissions
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (!userRecord?.profile_id) {
      return NextResponse.json(
        { error: 'User has no profile assigned' },
        { status: 403 }
      );
    }

    // Check if user can read properties (canRead on Property object)
    const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
    const propertyPermission = objectPermissions.find(p => p.objectType === 'Property');
    const canReadProperties = propertyPermission?.canRead || false;

    if (!canReadProperties) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view properties' },
        { status: 403 }
      );
    }

    // Get properties - users see only properties they created
    // If user has canViewAll, show all properties in organization
    const canViewAllProperties = propertyPermission?.canViewAll || false;
    
    let propertiesList: Array<{
      id: string;
      organization_id: string;
      name: string;
      address: string;
      city: string | null;
      property_type: string | null;
      total_units: number | null;
      notes: string | null;
      photo_urls: string[] | null;
      created_at: Date | string;
    }> = [];

    if (canViewAllProperties) {
      // User can view all properties in organization
      propertiesList = await db.select<{
        id: string;
        organization_id: string;
        name: string;
        address: string;
        city: string | null;
        property_type: string | null;
        total_units: number | null;
        notes: string | null;
        photo_urls: string[] | null;
        created_at: Date | string;
      }>('properties', {
        eq: { organization_id: user.organizationId },
      });
    } else {
      // User can only see properties they created
      // Note: Properties don't have a created_by field, so we'll show all for now
      // In a real scenario, you might want to add created_by to properties table
      propertiesList = await db.select<{
        id: string;
        organization_id: string;
        name: string;
        address: string;
        city: string | null;
        property_type: string | null;
        total_units: number | null;
        notes: string | null;
        photo_urls: string[] | null;
        created_at: Date | string;
      }>('properties', {
        eq: { organization_id: user.organizationId },
      });
    }

    // Get units for each property and calculate stats
    const propertiesWithStats = await Promise.all(
      propertiesList.map(async (property) => {
        const propertyUnits = await db.select<{
          id: string;
          status: string;
          rent_amount: string;
          charges_amount: string;
        }>('units', {
          eq: { property_id: property.id },
        });

        const totalUnits = propertyUnits.length;
        const occupiedUnits = propertyUnits.filter(u => u.status === 'occupied').length;
        const vacantUnits = propertyUnits.filter(u => u.status === 'vacant').length;
        const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

        // Calculate monthly income from occupied units
        const monthlyIncome = propertyUnits
          .filter(u => u.status === 'occupied')
          .reduce((sum, unit) => {
            const rent = parseFloat(unit.rent_amount || '0');
            const charges = parseFloat(unit.charges_amount || '0');
            return sum + rent + charges;
          }, 0);

        // Get first photo URL or use default
        const imageUrl = property.photo_urls && property.photo_urls.length > 0
          ? property.photo_urls[0]
          : 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop';

        return {
          id: property.id,
          name: property.name,
          address: property.address,
          city: property.city,
          propertyType: property.property_type,
          totalUnits: totalUnits || property.total_units || 0,
          occupiedUnits,
          vacantUnits,
          occupancyRate,
          monthlyIncome: Math.round(monthlyIncome),
          imageUrl,
          photoUrls: property.photo_urls || [],
          notes: property.notes,
          createdAt: property.created_at,
        };
      })
    );

    return NextResponse.json(propertiesWithStats);
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

