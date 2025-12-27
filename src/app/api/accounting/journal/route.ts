import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { journalEntries, journalLines, accounts } from '@/db/schema';
import { eq, and, desc, sum, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';
import { z } from 'zod';

const createJournalEntrySchema = z.object({
  entryDate: z.string().min(1, 'La date est requise'),
  description: z.string().optional(),
  reference: z.string().min(1, 'La référence est requise'),
  lines: z.array(z.object({
    accountId: z.string().uuid('Le compte est requis'),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
    description: z.string().optional(),
  })).min(2, 'Au moins 2 lignes sont requises'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01; // Allow small floating point differences
  },
  {
    message: 'Le total débit doit être égal au total crédit',
    path: ['lines'],
  }
);

/**
 * POST /api/accounting/journal
 * Create a new journal entry
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

    const body = await req.json();
    const validatedData = createJournalEntrySchema.parse(body);

    // Verify all accounts exist
    for (const line of validatedData.lines) {
      const accountRecords = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, line.accountId))
        .limit(1);

      if (accountRecords.length === 0) {
        return NextResponse.json(
          { error: `Compte ${line.accountId} introuvable` },
          { status: 400 }
        );
      }
    }

    // Create journal entry
    const [newEntry] = await db
      .insert(journalEntries)
      .values({
        organizationId: user.organizationId,
        entryDate: validatedData.entryDate,
        description: validatedData.description || null,
        reference: validatedData.reference,
        validated: false,
      })
      .returning();

    // Create journal lines
    const linesToInsert = validatedData.lines.map((line) => ({
      entryId: newEntry.id,
      accountId: line.accountId,
      debit: line.debit.toString(),
      credit: line.credit.toString(),
      description: line.description || null,
    }));

    await db.insert(journalLines).values(linesToInsert);

    // Fetch the created entry with lines
    const entryLines = await db
      .select({
        id: journalLines.id,
        accountId: journalLines.accountId,
        accountNumber: accounts.accountNumber,
        accountLabel: accounts.label,
        debit: journalLines.debit,
        credit: journalLines.credit,
        description: journalLines.description,
      })
      .from(journalLines)
      .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(eq(journalLines.entryId, newEntry.id));

    return NextResponse.json({
      id: newEntry.id,
      entryDate: newEntry.entryDate,
      description: newEntry.description,
      reference: newEntry.reference,
      validated: newEntry.validated,
      lines: entryLines.map((line) => ({
        id: line.id,
        accountNumber: line.accountNumber,
        accountLabel: line.accountLabel,
        debit: line.debit ? parseFloat(line.debit) : 0,
        credit: line.credit ? parseFloat(line.credit) : 0,
        description: line.description,
      })),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating journal entry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/accounting/journal
 * Get journal entries with lines for the current organization
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const accountFilter = searchParams.get('account');

    // Get journal entries
    let entriesQuery = db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.organizationId, user.organizationId))
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const entries = await entriesQuery;

    // Get total count
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.organizationId, user.organizationId));

    const totalCount = Number(totalCountResult[0]?.count || 0);

    // Get lines for each entry
    const entriesWithLines = await Promise.all(
      entries.map(async (entry) => {
        let linesQuery = db
          .select({
            id: journalLines.id,
            accountId: journalLines.accountId,
            accountNumber: accounts.accountNumber,
            accountLabel: accounts.label,
            debit: journalLines.debit,
            credit: journalLines.credit,
            description: journalLines.description,
          })
          .from(journalLines)
          .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
          .where(eq(journalLines.entryId, entry.id));

        if (accountFilter) {
          linesQuery = linesQuery.where(eq(accounts.accountNumber, accountFilter));
        }

        const lines = await linesQuery;

        return {
          id: entry.id,
          entryDate: entry.entryDate,
          description: entry.description,
          reference: entry.reference,
          validated: entry.validated,
          lines: lines.map((line) => ({
            id: line.id,
            accountNumber: line.accountNumber,
            accountLabel: line.accountLabel,
            debit: line.debit ? parseFloat(line.debit) : 0,
            credit: line.credit ? parseFloat(line.credit) : 0,
            description: line.description,
          })),
        };
      })
    );

    // Calculate statistics
    const currentMonth = new Date();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // Get current month entries count
    const currentMonthEntries = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          sql`${journalEntries.entryDate} >= ${firstDayOfMonth.toISOString().split('T')[0]}`,
          sql`${journalEntries.entryDate} <= ${lastDayOfMonth.toISOString().split('T')[0]}`
        )
      );

    const currentMonthCount = Number(currentMonthEntries[0]?.count || 0);

    // Get previous month entries count
    const previousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const lastDayOfPreviousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);

    const previousMonthEntries = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          sql`${journalEntries.entryDate} >= ${previousMonth.toISOString().split('T')[0]}`,
          sql`${journalEntries.entryDate} <= ${lastDayOfPreviousMonth.toISOString().split('T')[0]}`
        )
      );

    const previousMonthCount = Number(previousMonthEntries[0]?.count || 0);
    const entriesChange = previousMonthCount > 0 
      ? ((currentMonthCount - previousMonthCount) / previousMonthCount * 100).toFixed(1)
      : '0';

    // Calculate balances
    const debitBalanceResult = await db
      .select({ total: sum(journalLines.debit) })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(eq(journalEntries.organizationId, user.organizationId));

    const creditBalanceResult = await db
      .select({ total: sum(journalLines.credit) })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(eq(journalEntries.organizationId, user.organizationId));

    const totalDebit = parseFloat(debitBalanceResult[0]?.total || '0');
    const totalCredit = parseFloat(creditBalanceResult[0]?.total || '0');
    const balance = totalDebit - totalCredit;

    // Get previous month balances for comparison
    const previousMonthDebitResult = await db
      .select({ total: sum(journalLines.debit) })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          sql`${journalEntries.entryDate} < ${firstDayOfMonth.toISOString().split('T')[0]}`
        )
      );

    const previousMonthCreditResult = await db
      .select({ total: sum(journalLines.credit) })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          sql`${journalEntries.entryDate} < ${firstDayOfMonth.toISOString().split('T')[0]}`
        )
      );

    const previousDebit = parseFloat(previousMonthDebitResult[0]?.total || '0');
    const previousCredit = parseFloat(previousMonthCreditResult[0]?.total || '0');
    
    const debitChange = previousDebit > 0 
      ? ((totalDebit - previousDebit) / previousDebit * 100).toFixed(1)
      : '0';
    
    const creditChange = previousCredit > 0 
      ? ((totalCredit - previousCredit) / previousCredit * 100).toFixed(1)
      : '0';

    return NextResponse.json({
      entries: entriesWithLines,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      statistics: {
        currentMonthEntries: currentMonthCount,
        entriesChange: `+${entriesChange}%`,
        totalDebit,
        debitChange: `+${debitChange}%`,
        totalCredit,
        creditChange: creditChange.startsWith('-') ? creditChange : `-${creditChange}%`,
        balance,
        isBalanced: Math.abs(balance) < 0.01, // Consider balanced if difference is less than 0.01
      },
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
