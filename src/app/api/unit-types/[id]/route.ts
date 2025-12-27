import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { canUserPerformAction } from '@/lib/access-control';
import { z } from 'zod';

const updateUnitTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/unit-types/[id]
 * Update a unit type
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    // Check if user has permission
    const canEdit = await canUserPerformAction(
      user.id,
      user.organizationId,
      'Organization',
      'edit'
    );

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to update unit types' },
        { status: 403 }
      );
    }

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;

    // Check if unit type exists and belongs to organization
    const unitType = await db.selectOne<{
      id: string;
      organization_id: string;
      slug: string;
    }>('unit_types', {
      eq: { id },
    });

    if (!unitType) {
      return NextResponse.json(
        { error: 'Unit type not found' },
        { status: 404 }
      );
    }

    if (unitType.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = updateUnitTypeSchema.parse(body);

    // If slug is being updated, check for conflicts
    if (validatedData.slug && validatedData.slug !== unitType.slug) {
      const existing = await db.selectOne<{
        id: string;
      }>('unit_types', {
        eq: { 
          organization_id: user.organizationId,
          slug: validatedData.slug,
        },
      });

      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: 'Un type avec ce slug existe déjà' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    if (validatedData.slug !== undefined) {
      updateData.slug = validatedData.slug;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description || null;
    }
    if (validatedData.isActive !== undefined) {
      updateData.is_active = validatedData.isActive;
    }
    updateData.updated_at = new Date().toISOString();

    // Update unit type
    const updated = await db.updateOne('unit_types', updateData, {
      eq: { id },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating unit type:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/unit-types/[id]
 * Delete a unit type
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    // Check if user has permission
    const canDelete = await canUserPerformAction(
      user.id,
      user.organizationId,
      'Organization',
      'edit'
    );

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to delete unit types' },
        { status: 403 }
      );
    }

    const resolvedParams = 'then' in params ? await params : params;
    const { id } = resolvedParams;

    // Check if unit type exists and belongs to organization
    const unitType = await db.selectOne<{
      id: string;
      organization_id: string;
    }>('unit_types', {
      eq: { id },
    });

    if (!unitType) {
      return NextResponse.json(
        { error: 'Unit type not found' },
        { status: 404 }
      );
    }

    if (unitType.organization_id !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if any units are using this type
    const unitsUsingType = await db.count('units', {
      eq: {
        organization_id: user.organizationId,
        unit_type: unitType.slug,
      },
    });

    if (unitsUsingType > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer ce type car ${unitsUsingType} lot(s) l'utilise(nt). Veuillez d'abord modifier ou supprimer ces lots.` },
        { status: 400 }
      );
    }

    // Delete unit type
    await db.delete('unit_types', {
      eq: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting unit type:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

