import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/countries
 * Get all countries from the database
 */
export async function GET() {
  try {
    // Get all active countries, ordered by name
    const countries = await db.select<{
      code: string;
      name: string;
      name_en: string | null;
      currency: string;
      currency_symbol: string;
      is_active: boolean;
      is_ohada: boolean;
    }>('countries', {
      eq: { is_active: true },
      orderBy: { column: 'name', ascending: true },
    });

    // Map snake_case to camelCase for API response
    const mappedCountries = countries.map(country => ({
      code: country.code,
      name: country.name,
      nameEn: country.name_en,
      currency: country.currency,
      currencySymbol: country.currency_symbol,
      isActive: country.is_active,
      isOhada: country.is_ohada,
    }));

    return NextResponse.json({
      countries: mappedCountries,
      count: mappedCountries.length,
    });
  } catch (error: any) {
    console.error('Error fetching countries:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

