import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { journalEntries, journalLines, accounts } from '@/db/schema';
import { eq, sum, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/accounting/balance
 * Get OHADA balance sheet
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
    const asOfDate = searchParams.get('asOfDate') || new Date().toISOString().split('T')[0];

    // Get balance by account - simplified query
    const allAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.isActive, true))
      .orderBy(accounts.accountNumber);

    // Get balances for each account
    const accountBalances = await Promise.all(
      allAccounts.map(async (account) => {
        const linesResult = await db
          .select({
            totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit})::numeric, 0)`,
            totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit})::numeric, 0)`,
          })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(
            and(
              eq(journalLines.accountId, account.id),
              eq(journalEntries.organizationId, user.organizationId),
              sql`${journalEntries.entryDate}::date <= ${asOfDate}::date`
            )
          );

        const totals = linesResult[0] || { totalDebit: '0', totalCredit: '0' };

        return {
          accountNumber: account.accountNumber,
          accountLabel: account.label,
          category: account.category,
          totalDebit: totals.totalDebit,
          totalCredit: totals.totalCredit,
        };
      })
    );

    // Calculate totals
    const totalDebit = accountBalances.reduce((sum, acc) => sum + parseFloat(acc.totalDebit.toString()), 0);
    const totalCredit = accountBalances.reduce((sum, acc) => sum + parseFloat(acc.totalCredit.toString()), 0);
    const balance = totalDebit - totalCredit;

    return NextResponse.json({
      asOfDate,
      accounts: accountBalances.map((acc) => ({
        accountNumber: acc.accountNumber,
        accountLabel: acc.accountLabel,
        category: acc.category,
        debit: parseFloat(acc.totalDebit.toString()),
        credit: parseFloat(acc.totalCredit.toString()),
        balance: parseFloat(acc.totalDebit.toString()) - parseFloat(acc.totalCredit.toString()),
      })),
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balance,
        isBalanced: Math.abs(balance) < 0.01,
      },
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

