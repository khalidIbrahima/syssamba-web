import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { logEntityCreated, getRequestMetadata } from '@/lib/activity-tracker';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { z } from 'zod';

const createOwnerSchema = z.object({
  propertyId: z.string().min(1, 'La propriété est requise').optional(),
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  commissionRate: z.number().min(0).max(100).default(20),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

/**
 * GET /api/owners
 * Get all owners for the current organization
 */
export async function GET(request: Request) {
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

    // Check profile permissions for Owner read
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (userRecord?.profile_id) {
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const ownerPermission = objectPermissions.find(p => p.objectType === 'Owner');
      const canReadOwners = ownerPermission?.canRead || false;

      if (!canReadOwners) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view owners' },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';

    // Get all owners for the organization
    let ownersQuery: any = {
      eq: { organization_id: user.organizationId },
    };

    if (status !== 'all') {
      ownersQuery.eq = {
        ...ownersQuery.eq,
        is_active: status === 'active',
      };
    }

    const ownersList = await db.select<{
      id: string;
      organization_id: string;
      property_id: string | null;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      bank_account: string | null;
      bank_name: string | null;
      commission_rate: string;
      is_active: boolean;
      notes: string | null;
      created_at: Date | string;
    }>('owners', ownersQuery);

    // Get property and stats for each owner
    const ownersWithDetails = await Promise.all(
      ownersList.map(async (owner) => {
        let propertyName = null;
        let unitsCount = 0;

        // Get property if assigned
        if (owner.property_id) {
          const property = await db.selectOne<{
            id: string;
            name: string;
          }>('properties', {
            eq: { id: owner.property_id },
          });

          if (property) {
            propertyName = property.name;

            // Count units for this property
            const units = await db.select('units', {
              eq: { property_id: owner.property_id },
            });
            unitsCount = units.length;
          }
        }

        // Get owner transfers stats
        const transfers = await db.select<{
          id: string;
          amount: string;
          commission_amount: string;
          status: string;
        }>('owner_transfers', {
          eq: { owner_id: owner.id },
        });

        const totalTransfers = transfers.length;
        const totalCommission = transfers.reduce((sum, t) => sum + parseFloat(t.commission_amount || '0'), 0);
        const completedAmount = transfers
          .filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + parseFloat(t.amount || '0') - parseFloat(t.commission_amount || '0'), 0);
        const pendingAmount = transfers
          .filter(t => t.status === 'pending')
          .reduce((sum, t) => sum + parseFloat(t.amount || '0') - parseFloat(t.commission_amount || '0'), 0);
        const scheduledAmount = transfers
          .filter(t => t.status === 'scheduled')
          .reduce((sum, t) => sum + parseFloat(t.amount || '0') - parseFloat(t.commission_amount || '0'), 0);

        // Filter by search if provided
        const fullName = `${owner.first_name} ${owner.last_name}`.toLowerCase();
        const searchLower = search.toLowerCase();
        if (search && !fullName.includes(searchLower) && 
            !owner.email?.toLowerCase().includes(searchLower) &&
            !owner.phone?.includes(search)) {
          return null;
        }

        return {
          id: owner.id,
          firstName: owner.first_name,
          lastName: owner.last_name,
          email: owner.email,
          phone: owner.phone,
          bankAccount: owner.bank_account,
          bankName: owner.bank_name,
          commissionRate: parseFloat(owner.commission_rate || '20'),
          isActive: owner.is_active,
          propertyName,
          propertyId: owner.property_id,
          stats: {
            unitsCount,
            totalTransfers,
            totalCommission,
            completedAmount,
            pendingAmount,
            scheduledAmount,
          },
        };
      })
    );

    // Filter out null values from search
    const filteredOwners = ownersWithDetails.filter(owner => owner !== null);

    // Calculate overall stats
    const stats = {
      totalOwners: filteredOwners.length,
      activeOwners: filteredOwners.filter(o => o.isActive).length,
      totalCompletedAmount: filteredOwners.reduce((sum, o) => sum + o.stats.completedAmount, 0),
      totalPendingAmount: filteredOwners.reduce((sum, o) => sum + o.stats.pendingAmount, 0),
      totalScheduledAmount: filteredOwners.reduce((sum, o) => sum + o.stats.scheduledAmount, 0),
      totalCommission: filteredOwners.reduce((sum, o) => sum + o.stats.totalCommission, 0),
    };

    return NextResponse.json({
      owners: filteredOwners,
      stats,
    });
  } catch (error) {
    console.error('Error fetching owners:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owners
 * Create a new owner
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

    // Check profile permissions for Owner creation
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (userRecord?.profile_id) {
      const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
      const ownerPermission = objectPermissions.find(p => p.objectType === 'Owner');
      const canCreateOwners = ownerPermission?.canCreate || false;

      if (!canCreateOwners) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to create owners' },
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
    const validatedData = createOwnerSchema.parse(body);

    // Verify property belongs to organization if provided
    if (validatedData.propertyId) {
      const property = await db.selectOne<{
        id: string;
        organization_id: string;
        name: string;
      }>('properties', {
        eq: { id: validatedData.propertyId },
      });

      if (!property || property.organization_id !== user.organizationId) {
        return NextResponse.json(
          { error: 'Property not found or does not belong to your organization' },
          { status: 404 }
        );
      }
    }

    // Create owner
    const newOwner = await db.insertOne<{
      id: string;
      organization_id: string;
      property_id: string | null;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      bank_account: string | null;
      bank_name: string | null;
      commission_rate: string;
      is_active: boolean;
      notes: string | null;
      created_at: Date | string;
    }>('owners', {
      organization_id: user.organizationId,
      property_id: validatedData.propertyId || null,
      first_name: validatedData.firstName,
      last_name: validatedData.lastName,
      email: validatedData.email || null,
      phone: validatedData.phone || null,
      bank_account: validatedData.bankAccount || null,
      bank_name: validatedData.bankName || null,
      commission_rate: validatedData.commissionRate.toString(),
      is_active: validatedData.isActive,
      notes: validatedData.notes || null,
    });

    if (!newOwner) {
      return NextResponse.json(
        { error: 'Failed to create owner' },
        { status: 500 }
      );
    }

    // Log activity
    const requestHeaders = await headers();
    const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
    await logEntityCreated(
      user.organizationId,
      'owner',
      newOwner.id,
      user.id,
      `${validatedData.firstName} ${validatedData.lastName}`,
      {
        propertyId: validatedData.propertyId,
        email: validatedData.email,
        phone: validatedData.phone,
        commissionRate: validatedData.commissionRate,
        ipAddress,
        userAgent,
      }
    );

    // Map snake_case to camelCase for API response
    return NextResponse.json({
      id: newOwner.id,
      organizationId: newOwner.organization_id,
      propertyId: newOwner.property_id,
      firstName: newOwner.first_name,
      lastName: newOwner.last_name,
      email: newOwner.email,
      phone: newOwner.phone,
      bankAccount: newOwner.bank_account,
      bankName: newOwner.bank_name,
      commissionRate: parseFloat(newOwner.commission_rate),
      isActive: newOwner.is_active,
      notes: newOwner.notes,
      createdAt: newOwner.created_at,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating owner:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

