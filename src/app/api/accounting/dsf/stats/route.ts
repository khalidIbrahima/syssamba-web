import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { journalEntries, journalLines, accounts, organizations } from '@/db/schema';
import { eq, and, gte, lte, sql, count, like } from 'drizzle-orm';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';

/**
 * GET /api/accounting/dsf/stats
 * Get DSF statistics for the fiscal year
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

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Get validated journal entries count
    const [validatedCount] = await db
      .select({ count: count() })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          eq(journalEntries.validated, true),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate)
        )
      );

    // Check if balance is balanced
    const balanceResult = await db
      .select({
        totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit})::numeric, 0)`,
        totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit})::numeric, 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate)
        )
      );

    const totals = balanceResult[0] || { totalDebit: '0', totalCredit: '0' };
    const totalDebit = parseFloat(totals.totalDebit.toString());
    const totalCredit = parseFloat(totals.totalCredit.toString());
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    // Calculate monthly revenues (simplified - using revenue accounts)
    const monthlyRevenues = await Promise.all(
      Array.from({ length: 12 }, async (_, monthIndex) => {
        const monthStart = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const monthEnd = `${year}-${String(monthIndex + 1).padStart(2, '0')}-31`;
        
        // Get revenue from accounts starting with 7 (revenue accounts in SYSCOHADA)
        const revenueResult = await db
          .select({
            total: sql<number>`COALESCE(SUM(${journalLines.credit})::numeric, 0)`,
          })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
          .where(
            and(
              eq(journalEntries.organizationId, user.organizationId),
              gte(journalEntries.entryDate, monthStart),
              lte(journalEntries.entryDate, monthEnd),
              like(accounts.accountNumber, '7%')
            )
          );

        return {
          month: monthIndex + 1,
          revenue: parseFloat(revenueResult[0]?.total.toString() || '0') / 1000000, // Convert to millions
        };
      })
    );

    // Calculate total revenue and profit
    const totalRevenue = monthlyRevenues.reduce((sum, m) => sum + m.revenue, 0) * 1000000;
    
    // Calculate expenses (accounts starting with 6)
    const expensesResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${journalLines.debit})::numeric, 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate),
          like(accounts.accountNumber, '6%')
        )
      );

    const totalExpenses = parseFloat(expensesResult[0]?.total.toString() || '0');
    const netProfit = totalRevenue - totalExpenses;

    // Calculate taxes (simplified)
    const vatResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${journalLines.credit})::numeric, 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate),
          like(accounts.accountNumber, '445%') // VAT accounts
        )
      );

    const vatAmount = parseFloat(vatResult[0]?.total.toString() || '0');
    const corporateTax = netProfit > 0 ? netProfit * 0.25 : 0; // 25% corporate tax
    const propertyTax = totalRevenue * 0.015; // 1.5% property tax (CFPB)
    const totalTaxes = vatAmount + corporateTax + propertyTax;

    return NextResponse.json({
      year,
      period: {
        startDate,
        endDate,
        startDateFormatted: `01/01/${year}`,
        endDateFormatted: `31/12/${year}`,
      },
      journal: {
        validatedEntries: validatedCount?.count || 0,
        isBalanced,
        totalDebit,
        totalCredit,
      },
      financial: {
        monthlyRevenues: monthlyRevenues.map(m => ({
          month: m.month,
          monthName: new Date(year, m.month - 1).toLocaleDateString('fr-FR', { month: 'short' }),
          revenue: m.revenue,
        })),
        totalRevenue,
        netProfit,
        taxes: {
          vat: vatAmount,
          corporateTax,
          propertyTax,
          total: totalTaxes,
        },
      },
      documents: {
        count: 12, // Placeholder - would need to count actual documents
      },
    });
  } catch (error) {
    console.error('Error fetching DSF stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

