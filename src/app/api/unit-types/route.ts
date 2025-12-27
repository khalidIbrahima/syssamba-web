import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { canUserPerformAction } from '@/lib/access-control';
import { z } from 'zod';

const createUnitTypeSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100),
  slug: z.string().min(1, 'Le slug est requis').max(50).regex(/^[a-z0-9_-]+$/, 'Le slug doit contenir uniquement des lettres minuscules, chiffres, tirets et underscores'),
  description: z.string().optional(),
});

const updateUnitTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/unit-types
 * Get all unit types for the organization
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

    const unitTypes = await db.select<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      is_active: boolean;
      created_at: Date | string;
    }>('unit_types', {
      eq: { organization_id: user.organizationId },
      orderBy: { column: 'name', ascending: true },
    });

    return NextResponse.json({
      unitTypes: unitTypes.map(ut => ({
        id: ut.id,
        name: ut.name,
        slug: ut.slug,
        description: ut.description,
        isActive: ut.is_active,
        createdAt: ut.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching unit types:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/unit-types
 * Create a new custom unit type
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

    // Check if user has permission to create unit types (admin only)
    const canCreate = await canUserPerformAction(
      user.id,
      user.organizationId,
      'Organization',
      'edit'
    );

    if (!canCreate) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to create unit types' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createUnitTypeSchema.parse(body);

    // Check if slug already exists for this organization
    const existing = await db.selectOne<{
      id: string;
    }>('unit_types', {
      eq: { 
        organization_id: user.organizationId,
        slug: validatedData.slug,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Un type avec ce slug existe déjà' },
        { status: 400 }
      );
    }

    // Create unit type
    const newUnitType = await db.insertOne<{
      id: string;
      organization_id: string;
      name: string;
      slug: string;
      description: string | null;
      is_active: boolean;
      created_at: Date | string;
    }>('unit_types', {
      organization_id: user.organizationId,
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description || null,
      is_active: true,
    });

    return NextResponse.json({
      id: newUnitType.id,
      name: newUnitType.name,
      slug: newUnitType.slug,
      description: newUnitType.description,
      isActive: newUnitType.is_active,
      createdAt: newUnitType.created_at,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating unit type:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

