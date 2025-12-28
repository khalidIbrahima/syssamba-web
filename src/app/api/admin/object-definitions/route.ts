import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { z } from 'zod';

// Schema for creating/updating object definitions
const objectDefinitionSchema = z.object({
  objectKey: z.string().min(1).max(100).regex(/^[A-Z][a-zA-Z0-9]*$/, 'Must start with uppercase letter and contain only letters and numbers'),
  displayName: z.string().min(1).max(200),
  description: z.string().optional(),
  databaseTable: z.string().optional(),
  ownershipField: z.string().optional(),
  sensitiveFields: z.array(z.string()).optional().default([]),
  icon: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0),
});

// GET - List all object definitions
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
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // TODO: Check if user is super-admin
    // For now, we'll allow any user with organization edit permission
    // In production, you should check for a specific super-admin role or flag
    // const isSuperAdmin = user.role === 'owner' && user.organizationId === SYSTEM_ORG_ID;
    
    const objectDefinitions = await db.select<{
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
      orderBy: { column: 'sort_order', ascending: true },
    });

    return NextResponse.json({
      objectDefinitions: objectDefinitions.map((od) => ({
        id: od.id,
        objectKey: od.object_key,
        displayName: od.display_name,
        description: od.description,
        databaseTable: od.database_table,
        ownershipField: od.ownership_field,
        sensitiveFields: od.sensitive_fields || [],
        icon: od.icon,
        category: od.category,
        isActive: od.is_active,
        isSystem: od.is_system,
        sortOrder: od.sort_order,
        createdAt: od.created_at,
        updatedAt: od.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching object definitions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch object definitions' },
      { status: 500 }
    );
  }
}

// POST - Create a new object definition
export async function POST(request: Request) {
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
    // For now, we'll allow any user with organization edit permission
    // In production, you should check for a specific super-admin role or flag

    const body = await request.json();
    const validatedData = objectDefinitionSchema.parse(body);

    // Check if object_key already exists
    const existing = await db.selectOne<{ id: string }>('object_definitions', {
      eq: { object_key: validatedData.objectKey },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Object key already exists' },
        { status: 400 }
      );
    }

    // Insert new object definition
    const newDefinition = await db.insertOne('object_definitions', {
      object_key: validatedData.objectKey,
      display_name: validatedData.displayName,
      description: validatedData.description || null,
      database_table: validatedData.databaseTable || null,
      ownership_field: validatedData.ownershipField || null,
      sensitive_fields: JSON.stringify(validatedData.sensitiveFields || []),
      icon: validatedData.icon || null,
      category: validatedData.category || null,
      is_active: validatedData.isActive ?? true,
      is_system: false, // Only system objects are marked as system
      sort_order: validatedData.sortOrder ?? 0,
      created_by: user.id,
    });

    if (!newDefinition) {
      return NextResponse.json(
        { error: 'Failed to create object definition' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      objectDefinition: {
        id: newDefinition.id,
        objectKey: validatedData.objectKey,
        displayName: validatedData.displayName,
        description: validatedData.description,
        databaseTable: validatedData.databaseTable,
        ownershipField: validatedData.ownershipField,
        sensitiveFields: validatedData.sensitiveFields || [],
        icon: validatedData.icon,
        category: validatedData.category,
        isActive: validatedData.isActive ?? true,
        isSystem: false,
        sortOrder: validatedData.sortOrder ?? 0,
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating object definition:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create object definition' },
      { status: 500 }
    );
  }
}


