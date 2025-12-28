import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { accounts } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/accounting/accounts
 * Get all active accounts (SYSCOHADA chart of accounts)
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

    const accountsList = await db.select('accounts', {
      eq: { isActive: true },
      orderBy: { column: 'accountNumber', ascending: true }
    });

    return NextResponse.json(accountsList);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

