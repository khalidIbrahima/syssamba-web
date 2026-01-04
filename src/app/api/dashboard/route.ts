import { NextResponse } from 'next/server';
import { db, supabaseAdmin } from '@/lib/db';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';

/**
 * GET /api/dashboard
 * Get dashboard statistics and data
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

    const organizationId = user.organizationId;

    // Get user's profile
    const userWithProfile = await supabaseAdmin
      .from('users')
      .select('profile_id, profiles(name)')
      .eq('id', user.id)
      .single();

    const profileName = (userWithProfile.data?.profiles as any)?.name || 'Viewer';

    // Get all units for the organization
    const allUnits = await db.select<{
      id: string;
      status: string;
      rent_amount: string;
      charges_amount: string;
    }>('units', {
      eq: { organization_id: organizationId },
    });

    const totalUnits = allUnits.length;
    const occupiedUnits = allUnits.filter(u => u.status === 'occupied').length;
    const vacantUnits = allUnits.filter(u => u.status === 'vacant').length;
    const maintenanceUnits = allUnits.filter(u => u.status === 'maintenance').length;
    const reservedUnits = allUnits.filter(u => u.status === 'reserved').length;
    
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    // Calculate monthly revenue from occupied units
    const monthlyRevenue = allUnits
      .filter(u => u.status === 'occupied')
      .reduce((sum, unit) => {
        const rent = parseFloat(unit.rent_amount || '0');
        const charges = parseFloat(unit.charges_amount || '0');
        return sum + rent + charges;
      }, 0);

    // Get payments for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const currentMonthPayments = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .gte('paid_at', startOfMonth.toISOString())
      .lte('paid_at', endOfMonth.toISOString());

    const treasury = (currentMonthPayments.data || []).reduce(
      (sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 
      0
    );

    // Get previous month payments for comparison
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const previousMonthPayments = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .gte('paid_at', previousMonthStart.toISOString())
      .lte('paid_at', previousMonthEnd.toISOString());

    const previousMonthTreasury = (previousMonthPayments.data || []).reduce(
      (sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 
      0
    );
    const change = previousMonthTreasury > 0 
      ? ((treasury - previousMonthTreasury) / previousMonthTreasury) * 100 
      : 0;
    const changeAmount = treasury - previousMonthTreasury;

    // Get overdue payments (payments that should have been made but weren't)
    // For now, we'll use a simple calculation: units with status 'occupied' but no payment this month
    const overdueCount = occupiedUnits; // Simplified - in production, check actual lease dates
    const overdueAmount = 0; // Simplified - in production, calculate based on missing payments

    // Get tasks
    const allTasks = await db.select<{
      id: string;
      title: string | null;
      due_date: Date | string | null;
      status: string;
      priority: string;
    }>('tasks', {
      eq: { organization_id: organizationId },
    });

    const totalTasks = allTasks.length;
    const overdueTasks = allTasks.filter(t => {
      if (!t.due_date) return false;
      return new Date(t.due_date) < new Date() && t.status !== 'done';
    }).length;

    // Get inspections (tasks with specific type or title)
    const inspections = allTasks.filter(t => 
      t.title?.toLowerCase().includes('état des lieux') || 
      t.title?.toLowerCase().includes('inspection')
    ).length;

    // Revenue data for last 12 months
    const revenueData = [];
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    // Get revenue for each of the last 12 months
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthIndex = monthDate.getMonth();
      
      // Query payments for this specific month
      const monthPayments = await supabaseAdmin
        .from('payments')
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .gte('paid_at', monthDate.toISOString())
        .lte('paid_at', monthEnd.toISOString());
      
      const monthRevenue = (monthPayments.data || []).reduce(
        (sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 
        0
      );
      
      revenueData.push({
        month: months[monthIndex],
        revenue: Math.round(monthRevenue),
      });
    }

    // Lot distribution
    const lotDistribution = [
      { name: 'Occupés', value: occupiedUnits, color: '#10b981' },
      { name: 'Vacants', value: vacantUnits, color: '#f59e0b' },
      { name: 'En travaux', value: maintenanceUnits, color: '#ef4444' },
      { name: 'Réservés', value: reservedUnits, color: '#8b5cf6' },
    ].filter(item => item.value > 0);

    // Upcoming inspections (simplified - using tasks)
    const upcomingInspections = allTasks
      .filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 7 && (t.title?.toLowerCase().includes('état des lieux') || t.title?.toLowerCase().includes('inspection'));
      })
      .slice(0, 3)
      .map((task, index) => {
        const dueDate = task.due_date ? new Date(task.due_date) : new Date();
        const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let dateText = '';
        if (daysUntil === 0) dateText = "Aujourd'hui";
        else if (daysUntil === 1) dateText = 'Demain';
        else dateText = `Dans ${daysUntil} jours`;

        return {
          id: task.id,
          type: 'entry',
          unit: 'Lot à déterminer',
          property: 'Propriété à déterminer',
          date: dateText,
          contact: 'À déterminer',
          color: index % 2 === 0 ? 'blue' : 'green',
        };
      });

    // Overdue tasks
    const overdueTasksList = allTasks
      .filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date() && t.status !== 'done';
      })
      .slice(0, 5)
      .map((task) => {
        const dueDate = task.due_date ? new Date(task.due_date) : new Date();
        const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let priority = 'warning';
        let color = 'yellow';
        if (task.priority === 'urgent' || daysOverdue > 3) {
          priority = 'urgent';
          color = 'red';
        }

        return {
          id: task.id,
          title: task.title || 'Tâche sans titre',
          unit: 'Lot à déterminer',
          priority,
          days: daysOverdue,
          color,
        };
      });

    // Base data structure
    const baseData = {
      profile: profileName,
      treasury: {
        amount: Math.round(treasury),
        change: Math.round(change * 10) / 10,
        changeAmount: Math.round(changeAmount),
      },
      occupancy: {
        rate: occupancyRate,
        occupied: occupiedUnits,
        total: totalUnits,
      },
      overdue: {
        amount: Math.round(overdueAmount),
        count: overdueCount,
      },
      tasks: {
        total: totalTasks,
        overdue: overdueTasks,
        inspections,
      },
      revenueData,
      lotDistribution,
      upcomingInspections,
      overdueTasks: overdueTasksList,
    };

    // Profile-specific data
    let profileData: any = {};

    if (profileName === 'Accountant' || profileName === 'System Administrator') {
      // Accountant: Focus on financial data
      // Get journal entries count
      const journalEntries = await supabaseAdmin
        .from('journal_entries')
        .select('id', { count: 'exact' })
        .eq('organization_id', organizationId);

      // Get pending payments
      const pendingPayments = await supabaseAdmin
        .from('payments')
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('status', 'pending');

      const pendingAmount = (pendingPayments.data || []).reduce(
        (sum, p) => sum + parseFloat(p.amount?.toString() || '0'),
        0
      );

      profileData = {
        ...baseData,
        accounting: {
          journalEntriesCount: journalEntries.count || 0,
          pendingPayments: {
            count: pendingPayments.data?.length || 0,
            amount: Math.round(pendingAmount),
          },
        },
      };
    } else if (profileName === 'Agent') {
      // Agent: Focus on operational tasks and properties
      const properties = await db.select<{ id: string }>('properties', {
        eq: { organization_id: organizationId },
      });

      // Get assigned tasks
      const assignedTasks = allTasks.filter(t => {
        // In production, check if task is assigned to current user
        return t.status !== 'done';
      });

      profileData = {
        ...baseData,
        operations: {
          propertiesCount: properties.length,
          assignedTasks: assignedTasks.length,
          myTasks: assignedTasks.slice(0, 5).map((task) => ({
            id: task.id,
            title: task.title || 'Tâche sans titre',
            status: task.status,
            priority: task.priority,
            dueDate: task.due_date,
          })),
        },
      };
    } else if (profileName === 'Owner') {
      // Owner: Focus on owned properties and revenue
      const properties = await db.select<{ id: string }>('properties', {
        eq: { organization_id: organizationId },
      });

      profileData = {
        ...baseData,
        ownership: {
          propertiesCount: properties.length,
          totalRevenue: Math.round(monthlyRevenue),
          averageRent: totalUnits > 0 
            ? Math.round(monthlyRevenue / totalUnits)
            : 0,
        },
      };
    } else {
      // Viewer: Limited read-only data
      profileData = {
        ...baseData,
        viewOnly: true,
      };
    }

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

