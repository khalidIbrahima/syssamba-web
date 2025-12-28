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
    const allAccounts = await db.select('accounts', {
      eq: { isActive: true },
      orderBy: { column: 'accountNumber', ascending: true }
    });

    // TODO: Implement complex balance calculation with journal entries
    // For now, return simplified balance data
    const accountBalances = allAccounts.map((account: any) => ({
      accountNumber: account.accountNumber,
      accountLabel: account.label,
      category: account.category,
      totalDebit: 0,
      totalCredit: 0,
    }));

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

