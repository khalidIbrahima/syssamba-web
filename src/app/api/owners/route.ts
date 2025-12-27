import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { owners, properties, ownerTransfers, units } from '@/db/schema';
import { eq, and, count, sum, sql, or } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/owners
 * Get all owners for the current organization with statistics
 */
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';

    // Build where conditions
    const conditions = [eq(owners.organizationId, user.organizationId)];

    // Apply search filter
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        sql`(
          ${owners.firstName}::text ILIKE ${searchPattern} OR
          ${owners.lastName}::text ILIKE ${searchPattern} OR
          ${owners.email}::text ILIKE ${searchPattern} OR
          ${properties.name}::text ILIKE ${searchPattern}
        )`
      );
    }

    // Apply status filter
    if (status === 'active') {
      conditions.push(eq(owners.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(owners.isActive, false));
    }

    // Get all owners with their properties
    const ownersList = await db
      .select({
        id: owners.id,
        firstName: owners.firstName,
        lastName: owners.lastName,
        email: owners.email,
        phone: owners.phone,
        bankAccount: owners.bankAccount,
        bankName: owners.bankName,
        commissionRate: owners.commissionRate,
        isActive: owners.isActive,
        propertyId: owners.propertyId,
        propertyName: properties.name,
        createdAt: owners.createdAt,
      })
      .from(owners)
      .leftJoin(properties, eq(owners.propertyId, properties.id))
      .where(and(...conditions))
      .orderBy(owners.createdAt);

    // Get statistics for each owner
    const ownersWithStats = await Promise.all(
      ownersList.map(async (owner) => {
        // Count properties
        const [propertiesCount] = await db
          .select({ count: count() })
          .from(properties)
          .where(
            and(
              eq(properties.organizationId, user.organizationId),
              eq(properties.id, owner.propertyId)
            )
          );

        // Count units for this property
        const [unitsCount] = await db
          .select({ count: count() })
          .from(units)
          .where(
            and(
              eq(units.organizationId, user.organizationId),
              eq(units.propertyId, owner.propertyId)
            )
          );

        // Get transfer statistics
        const transferStats = await db
          .select({
            totalTransfers: count(),
            completedAmount: sum(ownerTransfers.amount),
            pendingAmount: sql<number>`SUM(CASE WHEN ${ownerTransfers.status} = 'pending' THEN ${ownerTransfers.amount} ELSE 0 END)`,
            scheduledAmount: sql<number>`SUM(CASE WHEN ${ownerTransfers.status} = 'scheduled' THEN ${ownerTransfers.amount} ELSE 0 END)`,
            totalCommission: sum(ownerTransfers.commissionAmount),
          })
          .from(ownerTransfers)
          .where(eq(ownerTransfers.ownerId, owner.id));

        const stats = transferStats[0] || {
          totalTransfers: 0,
          completedAmount: '0',
          pendingAmount: 0,
          scheduledAmount: 0,
          totalCommission: '0',
        };

        return {
          ...owner,
          stats: {
            propertiesCount: propertiesCount?.count || 0,
            unitsCount: unitsCount?.count || 0,
            totalTransfers: stats.totalTransfers || 0,
            completedAmount: parseFloat(stats.completedAmount?.toString() || '0'),
            pendingAmount: parseFloat(stats.pendingAmount?.toString() || '0'),
            scheduledAmount: parseFloat(stats.scheduledAmount?.toString() || '0'),
            totalCommission: parseFloat(stats.totalCommission?.toString() || '0'),
          },
        };
      })
    );

    // Calculate total statistics
    const totalStats = {
      totalOwners: ownersWithStats.length,
      activeOwners: ownersWithStats.filter((o) => o.isActive).length,
      totalCompletedAmount: ownersWithStats.reduce(
        (sum, o) => sum + o.stats.completedAmount,
        0
      ),
      totalPendingAmount: ownersWithStats.reduce(
        (sum, o) => sum + o.stats.pendingAmount,
        0
      ),
      totalScheduledAmount: ownersWithStats.reduce(
        (sum, o) => sum + o.stats.scheduledAmount,
        0
      ),
      totalCommission: ownersWithStats.reduce(
        (sum, o) => sum + o.stats.totalCommission,
        0
      ),
    };

    return NextResponse.json({
      owners: ownersWithStats,
      stats: totalStats,
    });
  } catch (error) {
    console.error('Error fetching owners:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

