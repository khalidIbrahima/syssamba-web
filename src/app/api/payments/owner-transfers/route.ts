import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db';

/**
 * GET /api/payments/owner-transfers
 * Get owner transfers with statistics and filters
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await checkAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'current-month';
    const status = searchParams.get('status') || 'all';
    const ownerId = searchParams.get('ownerId') || '';
    const minAmount = parseFloat(searchParams.get('minAmount') || '0');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 20;

    // Calculate date range based on period
    let startDate: Date;
    let endDate: Date = new Date();
    
    const now = new Date();
    switch (period) {
      case 'current-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      default:
        // Format: YYYY-MM
        const [year, month] = period.split('-').map(Number);
        if (year && month) {
          startDate = new Date(year, month - 1, 1);
          endDate = new Date(year, month, 0, 23, 59, 59);
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }
    }

    // Build query conditions
    const conditions: any = {
      eq: { organization_id: user.organizationId },
    };

    if (status !== 'all') {
      conditions.eq.status = status;
    }

    if (ownerId) {
      conditions.eq.owner_id = ownerId;
    }

    // Get all transfers for statistics (before pagination)
    const allTransfers = await db.select<{
      id: string;
      owner_id: string;
      amount: string;
      commission_amount: string;
      status: string;
      due_date: string;
      transferred_at: string | null;
    }>('owner_transfers', conditions);

    // Filter by date range and min amount
    const filteredTransfers = allTransfers.filter((transfer) => {
      const dueDate = new Date(transfer.due_date);
      const inDateRange = dueDate >= startDate && dueDate <= endDate;
      const amount = parseFloat(transfer.amount || '0');
      const meetsMinAmount = amount >= minAmount;
      return inDateRange && meetsMinAmount;
    });

    // Calculate statistics
    const totalToTransfer = filteredTransfers
      .filter(t => t.status === 'scheduled' || t.status === 'pending')
      .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const transfersMade = filteredTransfers
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const pending = filteredTransfers
      .filter(t => t.status === 'pending')
      .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    // Count active owners (owners with transfers in the period)
    const activeOwnerIds = new Set(
      filteredTransfers.map(t => t.owner_id).filter(Boolean)
    );
    const activeOwners = activeOwnerIds.size;

    // Get paginated transfers with owner details
    const offset = (page - 1) * limit;
    const paginatedTransfers = filteredTransfers.slice(offset, offset + limit);

    // Fetch owner details for paginated transfers
    const transfersWithOwners = await Promise.all(
      paginatedTransfers.map(async (transfer) => {
        let owner = null;
        if (transfer.owner_id) {
          const owners = await db.selectOne<{
            id: string;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
            avatar_url: string;
          }>('owners', {
            eq: { id: transfer.owner_id },
          });
          owner = owners;
        }

        return {
          id: transfer.id,
          amount: parseFloat(transfer.amount || '0'),
          commissionAmount: parseFloat(transfer.commission_amount || '0'),
          status: transfer.status,
          dueDate: transfer.due_date,
          transferredAt: transfer.transferred_at,
          owner: owner ? {
            id: owner.id,
            firstName: owner.first_name,
            lastName: owner.last_name,
            email: owner.email,
            phone: owner.phone,
            avatar: owner.avatar_url,
          } : null,
        };
      })
    );

    // Calculate evolution data for chart (last 6 months)
    const evolution: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      
      const monthTransfers = allTransfers.filter((t) => {
        const dueDate = new Date(t.due_date);
        return dueDate >= monthDate && dueDate <= monthEnd;
      });

      const completed = monthTransfers
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

      const scheduled = monthTransfers
        .filter(t => t.status === 'scheduled')
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

      evolution.push({
        date: monthDate.toISOString().split('T')[0],
        completed,
        scheduled,
      });
    }

    return NextResponse.json({
      stats: {
        totalToTransfer,
        transfersMade,
        pending,
        activeOwners,
      },
      transfers: transfersWithOwners,
      evolution,
      pagination: {
        page,
        limit,
        total: filteredTransfers.length,
        totalPages: Math.ceil(filteredTransfers.length / limit),
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

