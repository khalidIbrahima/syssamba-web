import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/accounting/balance-evolution
 * Get balance evolution data for the last 7 months from journal entries
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

    // Get balance evolution for the last 7 months
    const months = [];
    const now = new Date();
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Get total debit and credit for this month
      const journalEntries = await db.select<{
        id: string;
        entry_date: Date | string;
      }>('journal_entries', {
        eq: { organization_id: user.organizationId },
        filter: {
          entry_date: {
            gte: monthStart.toISOString().split('T')[0],
            lte: monthEnd.toISOString().split('T')[0],
          },
        },
      });

      // Get journal lines for these entries
      let totalDebit = 0;
      let totalCredit = 0;
      
      if (journalEntries.length > 0) {
        const entryIds = journalEntries.map(e => e.id);
        
        // Get all lines for these entries
        const journalLines = await db.select<{
          debit: string | null;
          credit: string | null;
        }>('journal_lines', {
          in: { entry_id: entryIds },
        });
        
        totalDebit = journalLines.reduce((sum, line) => sum + parseFloat(line.debit || '0'), 0);
        totalCredit = journalLines.reduce((sum, line) => sum + parseFloat(line.credit || '0'), 0);
      }
      
      // Calculate balance (in millions FCFA for display)
      const balance = (totalCredit - totalDebit) / 1000000;
      
      months.push({
        month: monthNames[date.getMonth()],
        balance: Math.round(balance * 10) / 10, // Round to 1 decimal
      });
    }

    return NextResponse.json({ data: months });
  } catch (error) {
    console.error('Error fetching balance evolution:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

