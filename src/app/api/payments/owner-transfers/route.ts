import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { ownerTransfers, owners, properties, units, payments } from '@/db/schema';
import { eq, and, gte, lte, desc, sum, sql, count, or } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/payments/owner-transfers
 * Get owner transfers data with statistics
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
    const period = searchParams.get('period') || 'current-month';
    const status = searchParams.get('status') || 'all';
    const ownerId = searchParams.get('ownerId') || 'all';
    const minAmount = parseFloat(searchParams.get('minAmount') || '0');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Calculate date range based on period
    let startDate: string;
    let endDate: string;
    const now = new Date();
    
    if (period === 'current-month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (period === 'last-month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else {
      // Custom period format: YYYY-MM
      const [year, month] = period.split('-');
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0];
      endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
    }

    // Build where conditions
    const conditions = [eq(ownerTransfers.organizationId, user.organizationId)];

    // Apply date range filter
    conditions.push(
      gte(sql`DATE(${ownerTransfers.dueDate})`, startDate),
      lte(sql`DATE(${ownerTransfers.dueDate})`, endDate)
    );

    // Apply status filter
    if (status !== 'all') {
      conditions.push(eq(ownerTransfers.status, status as 'scheduled' | 'pending' | 'completed' | 'cancelled'));
    }

    // Apply owner filter
    if (ownerId !== 'all') {
      conditions.push(eq(ownerTransfers.ownerId, ownerId));
    }

    // Apply min amount filter
    if (minAmount > 0) {
      conditions.push(gte(ownerTransfers.amount, minAmount.toString()));
    }

    // Get transfers with owner, property, and unit info
    const transfersList = await db
      .select({
        id: ownerTransfers.id,
        amount: ownerTransfers.amount,
        commissionAmount: ownerTransfers.commissionAmount,
        dueDate: ownerTransfers.dueDate,
        status: ownerTransfers.status,
        transferMethod: ownerTransfers.transferMethod,
        transferReference: ownerTransfers.transferReference,
        transferredAt: ownerTransfers.transferredAt,
        createdAt: ownerTransfers.createdAt,
        paymentId: ownerTransfers.paymentId,
        ownerId: owners.id,
        ownerFirstName: owners.firstName,
        ownerLastName: owners.lastName,
        ownerEmail: owners.email,
        ownerPhone: owners.phone,
        propertyId: properties.id,
        propertyName: properties.name,
        unitId: units.id,
        unitNumber: units.unitNumber,
        unitFloor: units.floor,
      })
      .from(ownerTransfers)
      .leftJoin(owners, eq(ownerTransfers.ownerId, owners.id))
      .leftJoin(properties, eq(ownerTransfers.propertyId, properties.id))
      .leftJoin(units, eq(ownerTransfers.unitId, units.id))
      .where(and(...conditions))
      .orderBy(desc(ownerTransfers.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // Get total count
    const [totalCount] = await db
      .select({ count: count() })
      .from(ownerTransfers)
      .where(and(...conditions));

    // Calculate statistics
    const statsResult = await db
      .select({
        totalToTransfer: sum(ownerTransfers.amount),
        transfersMade: sql<number>`SUM(CASE WHEN ${ownerTransfers.status} = 'completed' THEN ${ownerTransfers.amount} ELSE 0 END)`,
        pending: sql<number>`SUM(CASE WHEN ${ownerTransfers.status} IN ('pending', 'scheduled') THEN ${ownerTransfers.amount} ELSE 0 END)`,
        totalCommission: sum(ownerTransfers.commissionAmount),
      })
      .from(ownerTransfers)
      .where(
        and(
          eq(ownerTransfers.organizationId, user.organizationId),
          gte(sql`DATE(${ownerTransfers.dueDate})`, startDate),
          lte(sql`DATE(${ownerTransfers.dueDate})`, endDate)
        )
      );

    const stats = statsResult[0] || {
      totalToTransfer: '0',
      transfersMade: 0,
      pending: 0,
      totalCommission: '0',
    };

    // Get active owners count
    const [ownersCount] = await db
      .select({ count: count() })
      .from(owners)
      .where(
        and(
          eq(owners.organizationId, user.organizationId),
          eq(owners.isActive, true)
        )
      );

    // Format transfers
    const transfers = transfersList.map((t) => ({
      id: t.id,
      paymentId: t.paymentId,
      owner: {
        id: t.ownerId,
        name: `${t.ownerFirstName || ''} ${t.ownerLastName || ''}`.trim() || 'N/A',
        firstName: t.ownerFirstName || '',
        lastName: t.ownerLastName || '',
        email: t.ownerEmail || '',
        phone: t.ownerPhone || '',
        avatar: null,
      },
      property: {
        id: t.propertyId,
        name: t.propertyName || 'N/A',
        unit: t.unitNumber ? `${t.unitNumber}${t.unitFloor ? `, ${t.unitFloor}` : ''}` : 'N/A',
      },
      amount: parseFloat(t.amount.toString()),
      commissionAmount: parseFloat(t.commissionAmount?.toString() || '0'),
      dueDate: t.dueDate,
      status: t.status,
      transferMethod: t.transferMethod,
      transferReference: t.transferReference,
      transferredAt: t.transferredAt,
      createdAt: t.createdAt,
    }));

    // Get evolution data for chart (last 30 days)
    const evolutionData = [];
    const chartStartDate = new Date(now);
    chartStartDate.setDate(chartStartDate.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const date = new Date(chartStartDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const dayStats = await db
        .select({
          completed: sql<number>`SUM(CASE WHEN ${ownerTransfers.status} = 'completed' THEN ${ownerTransfers.amount} ELSE 0 END)`,
          scheduled: sql<number>`SUM(CASE WHEN ${ownerTransfers.status} IN ('scheduled', 'pending') THEN ${ownerTransfers.amount} ELSE 0 END)`,
        })
        .from(ownerTransfers)
        .where(
          and(
            eq(ownerTransfers.organizationId, user.organizationId),
            eq(sql`DATE(${ownerTransfers.dueDate})`, dateStr)
          )
        );

      const dayData = dayStats[0] || { completed: 0, scheduled: 0 };

      evolutionData.push({
        date: dateStr,
        completed: parseFloat(dayData.completed?.toString() || '0'),
        scheduled: parseFloat(dayData.scheduled?.toString() || '0'),
      });
    }

    return NextResponse.json({
      stats: {
        totalToTransfer: parseFloat(stats.totalToTransfer?.toString() || '0'),
        transfersMade: parseFloat(stats.transfersMade?.toString() || '0'),
        pending: parseFloat(stats.pending?.toString() || '0'),
        activeOwners: ownersCount?.count || 0,
        totalCommission: parseFloat(stats.totalCommission?.toString() || '0'),
      },
      transfers,
      evolution: evolutionData,
      pagination: {
        page,
        limit,
        total: totalCount?.count || 0,
        totalPages: Math.ceil((totalCount?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching owner transfers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
