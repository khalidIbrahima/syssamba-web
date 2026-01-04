import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db';

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

    // Fetch all active accounts ordered by account number
    const { data: accountsList, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_number', { ascending: true });

    if (error) {
      console.error('Error fetching accounts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch accounts', details: error.message },
        { status: 500 }
      );
    }

    // Map snake_case to camelCase for frontend
    const mappedAccounts = (accountsList || []).map((account: any) => ({
      id: account.id,
      accountNumber: account.account_number,
      label: account.label,
      category: account.category,
      isActive: account.is_active,
    }));

    return NextResponse.json(mappedAccounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/accounts
 * Create a new account
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

    const body = await req.json();
    const { accountNumber, label, category } = body;

    // Validation
    if (!accountNumber || !label || !category) {
      return NextResponse.json(
        { error: 'accountNumber, label, and category are required' },
        { status: 400 }
      );
    }

    // Validate category is between 1 and 9
    if (!/^[1-9]$/.test(category)) {
      return NextResponse.json(
        { error: 'Category must be between 1 and 9' },
        { status: 400 }
      );
    }

    // Check if account number already exists
    const { data: existingAccount } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('account_number', accountNumber)
      .single();

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Account number already exists' },
        { status: 409 }
      );
    }

    // Create the account
    const { data: newAccount, error } = await supabaseAdmin
      .from('accounts')
      .insert({
        account_number: accountNumber,
        label: label,
        category: category,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating account:', error);
      return NextResponse.json(
        { error: 'Failed to create account', details: error.message },
        { status: 500 }
      );
    }

    // Map snake_case to camelCase
    const mappedAccount = {
      id: newAccount.id,
      accountNumber: newAccount.account_number,
      label: newAccount.label,
      category: newAccount.category,
      isActive: newAccount.is_active,
    };

    return NextResponse.json(mappedAccount, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

