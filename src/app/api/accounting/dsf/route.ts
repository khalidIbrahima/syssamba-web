import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { journalEntries, journalLines, accounts, organizations } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { escapeCSV } from '@/lib/utils';

/**
 * GET /api/accounting/dsf
 * Generate DSF (Déclaration des Salaires et Fichiers) data
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
    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    // Get all journal entries in the period
    const entries = await db
      .select({
        id: journalEntries.id,
        entryDate: journalEntries.entryDate,
        reference: journalEntries.reference,
        description: journalEntries.description,
        validated: journalEntries.validated,
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate)
        )
      )
      .orderBy(journalEntries.entryDate);

    // Get all lines for these entries
    const entriesWithLines = await Promise.all(
      entries.map(async (entry) => {
        const lines = await db
          .select({
            accountNumber: accounts.accountNumber,
            accountLabel: accounts.label,
            debit: journalLines.debit,
            credit: journalLines.credit,
          })
          .from(journalLines)
          .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
          .where(eq(journalLines.entryId, entry.id));

        return {
          ...entry,
          lines: lines.map((line) => ({
            accountNumber: line.accountNumber,
            accountLabel: line.accountLabel,
            debit: line.debit ? parseFloat(line.debit) : 0,
            credit: line.credit ? parseFloat(line.credit) : 0,
          })),
        };
      })
    );

    // Calculate totals
    const totalDebit = entriesWithLines.reduce((sum, entry) => {
      return sum + entry.lines.reduce((lineSum, line) => lineSum + line.debit, 0);
    }, 0);

    const totalCredit = entriesWithLines.reduce((sum, entry) => {
      return sum + entry.lines.reduce((lineSum, line) => lineSum + line.credit, 0);
    }, 0);

    return NextResponse.json({
      organization: {
        name: organization.name,
        country: organization.country,
      },
      period: {
        startDate,
        endDate,
      },
      entries: entriesWithLines,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balance: totalDebit - totalCredit,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating DSF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/dsf
 * Export DSF as file (CSV/Excel)
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

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { format = 'csv', startDate, endDate } = body;

    // Get all journal entries in the period
    const entries = await db
      .select({
        id: journalEntries.id,
        entryDate: journalEntries.entryDate,
        reference: journalEntries.reference,
        description: journalEntries.description,
        validated: journalEntries.validated,
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.organizationId, user.organizationId),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate)
        )
      )
      .orderBy(journalEntries.entryDate);

    // Get all lines for these entries
    const entriesWithLines = await Promise.all(
      entries.map(async (entry) => {
        const lines = await db
          .select({
            accountNumber: accounts.accountNumber,
            accountLabel: accounts.label,
            debit: journalLines.debit,
            credit: journalLines.credit,
          })
          .from(journalLines)
          .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
          .where(eq(journalLines.entryId, entry.id));

        return {
          ...entry,
          lines: lines.map((line) => ({
            accountNumber: line.accountNumber,
            accountLabel: line.accountLabel,
            debit: line.debit ? parseFloat(line.debit) : 0,
            credit: line.credit ? parseFloat(line.credit) : 0,
          })),
        };
      })
    );

    const dsfData = {
      organization: {
        name: organization.name,
        country: organization.country,
      },
      period: {
        startDate,
        endDate,
      },
      entries: entriesWithLines,
    };

    if (format === 'csv') {
      // Generate CSV with UTF-8 BOM for proper Excel compatibility
      // UTF-8 BOM: 0xEF 0xBB 0xBF
      const BOM = '\uFEFF';
      let csv = BOM + 'Date,Référence,Description,Compte,Libellé Compte,Débit,Crédit\n';
      
      dsfData.entries.forEach((entry: any) => {
        entry.lines.forEach((line: any) => {
          csv += `${entry.entryDate},${escapeCSV(entry.reference)},${escapeCSV(entry.description || '')},${line.accountNumber},${escapeCSV(line.accountLabel || '')},${line.debit},${line.credit}\n`;
        });
      });

      // Convert to Buffer with UTF-8 encoding
      const csvBuffer = Buffer.from(csv, 'utf8');

      return new NextResponse(csvBuffer, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="dsf_${startDate}_${endDate}.csv"; filename*=UTF-8''dsf_${startDate}_${endDate}.csv`,
        },
      });
    }

    return NextResponse.json(dsfData);
  } catch (error) {
    console.error('Error exporting DSF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

