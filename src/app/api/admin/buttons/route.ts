import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { supabaseAdmin } from '@/lib/db';
import { z } from 'zod';

// Validation schemas
const createButtonSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  name: z.string().min(1, 'Name is required'),
  label: z.string().min(1, 'Label is required'),
  buttonType: z.enum(['button', 'icon', 'link', 'menu_item']).default('button'),
  variant: z.enum(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']).optional(),
  size: z.enum(['default', 'sm', 'lg', 'icon']).optional(),
  objectType: z.string().min(1, 'Object type is required'),
  action: z.enum(['create', 'read', 'update', 'edit', 'delete', 'view', 'export', 'import', 'print', 'custom']).default('create'),
  icon: z.string().optional(),
  tooltip: z.string().optional(),
  sortOrder: z.number().default(0),
  featureId: z.string().uuid().nullable().optional(),
  requiredPermission: z.string().optional(),
  requiredObjectType: z.string().optional(),
  requiredObjectAction: z.enum(['read', 'create', 'edit', 'delete']).default('create'),
  isActive: z.boolean().default(true),
  isSystemButton: z.boolean().default(false),
  description: z.string().optional(),
});

const updateButtonSchema = z.object({
  key: z.string().min(1, 'Key is required').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  label: z.string().min(1, 'Label is required').optional(),
  buttonType: z.enum(['button', 'icon', 'link', 'menu_item']).optional(),
  variant: z.enum(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']).optional(),
  size: z.enum(['default', 'sm', 'lg', 'icon']).optional(),
  objectType: z.string().min(1, 'Object type is required').optional(),
  action: z.enum(['create', 'read', 'update', 'edit', 'delete', 'view', 'export', 'import', 'print', 'custom']).optional(),
  icon: z.string().nullable().optional(),
  tooltip: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  featureId: z.string().uuid().nullable().optional(),
  requiredPermission: z.string().nullable().optional(),
  requiredObjectType: z.string().nullable().optional(),
  requiredObjectAction: z.enum(['read', 'create', 'edit', 'delete']).optional(),
  isActive: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

/**
 * GET /api/admin/buttons
 * Get all buttons with their profile associations
 */
export async function GET(request: NextRequest) {
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    // Get all buttons (without join to avoid FK constraint issues)
    const { data: buttons, error: buttonsError } = await supabaseAdmin
      .from('buttons')
      .select('*')
      .order('object_type', { ascending: true })
      .order('sort_order', { ascending: true });

    if (buttonsError) {
      console.error('Error fetching buttons:', buttonsError);
      return NextResponse.json(
        { error: 'Failed to fetch buttons', details: buttonsError },
        { status: 500 }
      );
    }

    // Get all features for manual joining (separate query to avoid FK constraint issues)
    const { data: features, error: featuresError } = await supabaseAdmin
      .from('features')
      .select('id, name, display_name');

    if (featuresError) {
      console.warn('Error fetching features (non-critical):', featuresError);
    }

    // Join buttons with features manually
    const buttonsWithFeatures = (buttons || []).map((button: any) => {
      const feature = features?.find((f: any) => f.id === button.feature_id);
      return {
        ...button,
        feature: feature ? {
          id: feature.id,
          name: feature.name,
          display_name: feature.display_name,
        } : null,
      };
    });

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, display_name')
      .order('name', { ascending: true });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    // Get all profile-button associations
    const { data: profileButtons, error: profileButtonsError } = await supabaseAdmin
      .from('profile_buttons')
      .select('*');

    if (profileButtonsError) {
      console.error('Error fetching profile buttons:', profileButtonsError);
      return NextResponse.json(
        { error: 'Failed to fetch profile buttons' },
        { status: 500 }
      );
    }

    // Map buttons with profile associations
    const buttonsWithProfiles = buttonsWithFeatures.map((button: any) => {
      const buttonProfiles = (profileButtons || [])
        .filter((pb: any) => pb.button_id === button.id)
        .map((pb: any) => {
          const profile = profiles?.find((p: any) => p.id === pb.profile_id);
          return {
            profileId: pb.profile_id,
            profileName: profile?.name || profile?.display_name || 'Unknown',
            isEnabled: pb.is_enabled,
            isVisible: pb.is_visible,
            customLabel: pb.custom_label,
            customIcon: pb.custom_icon,
          };
        });

      return {
        ...button,
        profiles: buttonProfiles,
      };
    });

    return NextResponse.json({
      buttons: buttonsWithProfiles,
      profiles: profiles || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/buttons:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/buttons
 * Create a new button
 */
export async function POST(request: NextRequest) {
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createButtonSchema.parse(body);

    // Check if key already exists
    const { data: existingButton } = await supabaseAdmin
      .from('buttons')
      .select('id')
      .eq('key', validatedData.key)
      .single();

    if (existingButton) {
      return NextResponse.json(
        { error: 'Button with this key already exists' },
        { status: 400 }
      );
    }

    // Insert button
    const { data: newButton, error: insertError } = await supabaseAdmin
      .from('buttons')
      .insert({
        key: validatedData.key,
        name: validatedData.name,
        label: validatedData.label,
        button_type: validatedData.buttonType,
        variant: validatedData.variant || 'default',
        size: validatedData.size || 'default',
        object_type: validatedData.objectType,
        action: validatedData.action,
        icon: validatedData.icon || null,
        tooltip: validatedData.tooltip || null,
        sort_order: validatedData.sortOrder,
        feature_id: validatedData.featureId || null,
        required_permission: validatedData.requiredPermission || null,
        required_object_type: validatedData.requiredObjectType || null,
        required_object_action: validatedData.requiredObjectAction,
        is_active: validatedData.isActive,
        is_system_button: validatedData.isSystemButton,
        description: validatedData.description || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating button:', insertError);
      return NextResponse.json(
        { error: 'Failed to create button', details: insertError.message },
        { status: 500 }
      );
    }

    // Associate button with all profiles by default
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id');

    if (profiles && profiles.length > 0) {
      const profileButtonInserts = profiles.map((profile: any) => ({
        profile_id: profile.id,
        button_id: newButton.id,
        is_enabled: true,
        is_visible: true,
      }));

      await supabaseAdmin
        .from('profile_buttons')
        .insert(profileButtonInserts);
    }

    return NextResponse.json(
      { button: newButton },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error in POST /api/admin/buttons:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/buttons
 * Update an existing button
 */
export async function PUT(request: NextRequest) {
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Button ID is required' },
        { status: 400 }
      );
    }

    // Check if button exists
    const { data: existingButton } = await supabaseAdmin
      .from('buttons')
      .select('id, is_system_button')
      .eq('id', id)
      .single();

    if (!existingButton) {
      return NextResponse.json(
        { error: 'Button not found' },
        { status: 404 }
      );
    }

    // Don't allow updating system buttons
    if (existingButton.is_system_button) {
      return NextResponse.json(
        { error: 'Cannot update system button' },
        { status: 403 }
      );
    }

    const validatedData = updateButtonSchema.parse(updateData);

    // Build update object
    const updateObject: any = {};
    if (validatedData.key !== undefined) updateObject.key = validatedData.key;
    if (validatedData.name !== undefined) updateObject.name = validatedData.name;
    if (validatedData.label !== undefined) updateObject.label = validatedData.label;
    if (validatedData.buttonType !== undefined) updateObject.button_type = validatedData.buttonType;
    if (validatedData.variant !== undefined) updateObject.variant = validatedData.variant;
    if (validatedData.size !== undefined) updateObject.size = validatedData.size;
    if (validatedData.objectType !== undefined) updateObject.object_type = validatedData.objectType;
    if (validatedData.action !== undefined) updateObject.action = validatedData.action;
    if (validatedData.icon !== undefined) updateObject.icon = validatedData.icon;
    if (validatedData.tooltip !== undefined) updateObject.tooltip = validatedData.tooltip;
    if (validatedData.sortOrder !== undefined) updateObject.sort_order = validatedData.sortOrder;
    if (validatedData.featureId !== undefined) updateObject.feature_id = validatedData.featureId;
    if (validatedData.requiredPermission !== undefined) updateObject.required_permission = validatedData.requiredPermission;
    if (validatedData.requiredObjectType !== undefined) updateObject.required_object_type = validatedData.requiredObjectType;
    if (validatedData.requiredObjectAction !== undefined) updateObject.required_object_action = validatedData.requiredObjectAction;
    if (validatedData.isActive !== undefined) updateObject.is_active = validatedData.isActive;
    if (validatedData.description !== undefined) updateObject.description = validatedData.description;

    // Update button
    const { data: updatedButton, error: updateError } = await supabaseAdmin
      .from('buttons')
      .update(updateObject)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating button:', updateError);
      return NextResponse.json(
        { error: 'Failed to update button', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ button: updatedButton });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error in PUT /api/admin/buttons:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/buttons
 * Delete a button
 */
export async function DELETE(request: NextRequest) {
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Button ID is required' },
        { status: 400 }
      );
    }

    // Check if button exists and is not a system button
    const { data: existingButton } = await supabaseAdmin
      .from('buttons')
      .select('id, is_system_button')
      .eq('id', id)
      .single();

    if (!existingButton) {
      return NextResponse.json(
        { error: 'Button not found' },
        { status: 404 }
      );
    }

    // Don't allow deleting system buttons
    if (existingButton.is_system_button) {
      return NextResponse.json(
        { error: 'Cannot delete system button' },
        { status: 403 }
      );
    }

    // Delete button (cascade will delete profile_buttons associations)
    const { error: deleteError } = await supabaseAdmin
      .from('buttons')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting button:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete button', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/buttons:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

