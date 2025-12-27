import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { z } from 'zod';

// Schema for updating object definitions
const updateObjectDefinitionSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  databaseTable: z.string().optional(),
  ownershipField: z.string().optional(),
  sensitiveFields: z.array(z.string()).optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

// GET - Get a specific object definition
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await checkAuth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const objectDefinition = await db.selectOne<{
      id: string;
      object_key: string;
      display_name: string;
      description: string | null;
      database_table: string | null;
      ownership_field: string | null;
      sensitive_fields: string[] | null;
      icon: string | null;
      category: string | null;
      is_active: boolean;
      is_system: boolean;
      sort_order: number;
      created_at: string;
      updated_at: string;
    }>('object_definitions', {
      eq: { id: params.id },
    });

    if (!objectDefinition) {
      return NextResponse.json(
        { error: 'Object definition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      objectDefinition: {
        id: objectDefinition.id,
        objectKey: objectDefinition.object_key,
        displayName: objectDefinition.display_name,
        description: objectDefinition.description,
        databaseTable: objectDefinition.database_table,
        ownershipField: objectDefinition.ownership_field,
        sensitiveFields: objectDefinition.sensitive_fields || [],
        icon: objectDefinition.icon,
        category: objectDefinition.category,
        isActive: objectDefinition.is_active,
        isSystem: objectDefinition.is_system,
        sortOrder: objectDefinition.sort_order,
        createdAt: objectDefinition.created_at,
        updatedAt: objectDefinition.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching object definition:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch object definition' },
      { status: 500 }
    );
  }
}

// PATCH - Update an object definition
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
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
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // TODO: Check if user is super-admin

    // Check if object definition exists
    const existing = await db.selectOne<{ is_system: boolean }>('object_definitions', {
      eq: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Object definition not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateObjectDefinitionSchema.parse(body);

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (validatedData.displayName !== undefined) {
      updateData.display_name = validatedData.displayName;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description || null;
    }
    if (validatedData.databaseTable !== undefined) {
      updateData.database_table = validatedData.databaseTable || null;
    }
    if (validatedData.ownershipField !== undefined) {
      updateData.ownership_field = validatedData.ownershipField || null;
    }
    if (validatedData.sensitiveFields !== undefined) {
      updateData.sensitive_fields = JSON.stringify(validatedData.sensitiveFields);
    }
    if (validatedData.icon !== undefined) {
      updateData.icon = validatedData.icon || null;
    }
    if (validatedData.category !== undefined) {
      updateData.category = validatedData.category || null;
    }
    if (validatedData.isActive !== undefined) {
      updateData.is_active = validatedData.isActive;
    }
    if (validatedData.sortOrder !== undefined) {
      updateData.sort_order = validatedData.sortOrder;
    }

    await db.update('object_definitions', {
      eq: { id: params.id },
      data: updateData,
    });

    // Fetch updated definition
    const updated = await db.selectOne<{
      id: string;
      object_key: string;
      display_name: string;
      description: string | null;
      database_table: string | null;
      ownership_field: string | null;
      sensitive_fields: string[] | null;
      icon: string | null;
      category: string | null;
      is_active: boolean;
      is_system: boolean;
      sort_order: number;
    }>('object_definitions', {
      eq: { id: params.id },
    });

    return NextResponse.json({
      objectDefinition: {
        id: updated!.id,
        objectKey: updated!.object_key,
        displayName: updated!.display_name,
        description: updated!.description,
        databaseTable: updated!.database_table,
        ownershipField: updated!.ownership_field,
        sensitiveFields: updated!.sensitive_fields || [],
        icon: updated!.icon,
        category: updated!.category,
        isActive: updated!.is_active,
        isSystem: updated!.is_system,
        sortOrder: updated!.sort_order,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating object definition:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update object definition' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an object definition
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
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
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // TODO: Check if user is super-admin

    // Check if object definition exists and is not a system object
    const existing = await db.selectOne<{ is_system: boolean; object_key: string }>('object_definitions', {
      eq: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Object definition not found' },
        { status: 404 }
      );
    }

    if (existing.is_system) {
      return NextResponse.json(
        { error: 'Cannot delete system object definitions' },
        { status: 400 }
      );
    }

    // Check if any profiles have permissions for this object
    const permissionsCount = await db.count('profile_object_permissions', {
      eq: { object_type: existing.object_key },
    });

    if (permissionsCount > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete object definition: profiles still have permissions for this object',
          permissionsCount,
        },
        { status: 400 }
      );
    }

    // Delete the object definition
    await db.delete('object_definitions', {
      eq: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting object definition:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete object definition' },
      { status: 500 }
    );
  }
}


