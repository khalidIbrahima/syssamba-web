import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { supabaseAdmin } from '@/lib/db';
import { BUTTON_DEFINITIONS, getPermissionFieldForAction } from '@/lib/button-definitions';
import { z } from 'zod';

// Validation schema
const updateButtonPermissionSchema = z.object({
  buttonKey: z.string().min(1, 'Button key is required'),
  isEnabled: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  customLabel: z.string().nullable().optional(),
  customIcon: z.string().nullable().optional(),
});

/**
 * GET /api/profiles/[id]/button-permissions
 * Get all button permissions for a profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const profileId = id;

    // Validate profileId is a valid UUID
    if (!profileId || profileId === 'null' || profileId === 'undefined') {
      return NextResponse.json(
        { error: 'Invalid profile ID' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileId)) {
      return NextResponse.json(
        { error: 'Invalid profile ID format' },
        { status: 400 }
      );
    }

    // Get object permissions for this profile
    const { data: objectPermissions, error: permError } = await supabaseAdmin
      .from('profile_object_permissions')
      .select('object_type, can_create, can_read, can_edit, can_delete')
      .eq('profile_id', profileId);

    if (permError) {
      console.error('Error fetching object permissions:', permError);
      return NextResponse.json(
        { error: 'Failed to fetch object permissions' },
        { status: 500 }
      );
    }

    // Get all buttons from database (to get IDs for profile_buttons)
    const { data: allButtons, error: buttonsError } = await supabaseAdmin
      .from('buttons')
      .select('id, key');

    if (buttonsError) {
      console.error('Error fetching buttons:', buttonsError);
    }

    const buttonKeyToIdMap = new Map(
      (allButtons || []).map((btn: any) => [btn.key, btn.id])
    );

    // Get profile button overrides
    const { data: profileButtons, error: profileButtonsError } = await supabaseAdmin
      .from('profile_buttons')
      .select('button_id, is_enabled, is_visible, custom_label, custom_icon, buttons!inner(key)')
      .eq('profile_id', profileId);

    if (profileButtonsError) {
      console.error('Error fetching profile buttons:', profileButtonsError);
      // Continue without overrides if there's an error
    }

    // Create a map of button overrides (keyed by button key)
    const buttonOverridesMap = new Map(
      (profileButtons || []).map((pb: any) => [
        pb.buttons?.key,
        {
          isEnabled: pb.is_enabled,
          isVisible: pb.is_visible,
          customLabel: pb.custom_label,
          customIcon: pb.custom_icon,
        },
      ])
    );

    // Build button permissions based on definitions and object permissions
    const buttonPermissions = BUTTON_DEFINITIONS.map((buttonDef) => {
      const objectPerm = objectPermissions?.find(
        (op: any) => op.object_type === buttonDef.objectType
      );

      const permissionField = getPermissionFieldForAction(buttonDef.action);
      const shouldEnable = objectPerm?.[permissionField] ?? false;

      const override = buttonOverridesMap.get(buttonDef.key);

      // Check if override exists and differs from object permission
      const isOverride = override !== undefined && (
        override.isEnabled !== shouldEnable ||
        override.isVisible !== shouldEnable ||
        override.customLabel !== null ||
        override.customIcon !== null
      );

      return {
        key: buttonDef.key,
        name: buttonDef.name,
        label: buttonDef.label,
        objectType: buttonDef.objectType,
        action: buttonDef.action,
        icon: buttonDef.icon,
        variant: buttonDef.variant,
        size: buttonDef.size,
        tooltip: buttonDef.tooltip,
        description: buttonDef.description,
        // Permission from object permissions
        objectPermission: {
          canCreate: objectPerm?.can_create ?? false,
          canRead: objectPerm?.can_read ?? false,
          canEdit: objectPerm?.can_edit ?? false,
          canDelete: objectPerm?.can_delete ?? false,
        },
        // Computed permission (from object permission, can be overridden)
        isEnabled: override?.isEnabled ?? shouldEnable,
        isVisible: override?.isVisible ?? shouldEnable,
        // Custom overrides
        customLabel: override?.customLabel ?? null,
        customIcon: override?.customIcon ?? null,
        // Whether this is an override (different from object permission)
        isOverride,
      };
    });

    return NextResponse.json({
      buttonPermissions,
      objectPermissions: objectPermissions || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/profiles/[id]/button-permissions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profiles/[id]/button-permissions
 * Update button permissions for a profile
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const profileId = id;

    // Validate profileId is a valid UUID
    if (!profileId || profileId === 'null' || profileId === 'undefined') {
      return NextResponse.json(
        { error: 'Invalid profile ID' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileId)) {
      return NextResponse.json(
        { error: 'Invalid profile ID format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { buttonPermissions } = body;

    if (!Array.isArray(buttonPermissions)) {
      return NextResponse.json(
        { error: 'buttonPermissions must be an array' },
        { status: 400 }
      );
    }

    // Get all buttons from database (to get IDs)
    const { data: allButtons, error: buttonsError } = await supabaseAdmin
      .from('buttons')
      .select('id, key');

    if (buttonsError) {
      console.error('Error fetching buttons:', buttonsError);
      return NextResponse.json(
        { error: 'Failed to fetch buttons' },
        { status: 500 }
      );
    }

    const buttonKeyToIdMap = new Map(
      (allButtons || []).map((btn: any) => [btn.key, btn.id])
    );

    // Process each button permission
    const updates: Promise<any>[] = [];

    for (const buttonPerm of buttonPermissions) {
      const validated = updateButtonPermissionSchema.parse(buttonPerm);
      const buttonId = buttonKeyToIdMap.get(validated.buttonKey);

      if (!buttonId) {
        console.warn(`Button ${validated.buttonKey} not found in database, skipping`);
        continue;
      }

      // Check if override exists
      const { data: existing } = await supabaseAdmin
        .from('profile_buttons')
        .select('*')
        .eq('profile_id', profileId)
        .eq('button_id', buttonId)
        .single();

      const updateData: any = {};
      if (validated.isEnabled !== undefined) updateData.is_enabled = validated.isEnabled;
      if (validated.isVisible !== undefined) updateData.is_visible = validated.isVisible;
      if (validated.customLabel !== undefined) updateData.custom_label = validated.customLabel;
      if (validated.customIcon !== undefined) updateData.custom_icon = validated.customIcon;

      if (existing) {
        // Update existing override
        updates.push(
          supabaseAdmin
            .from('profile_buttons')
            .update(updateData)
            .eq('profile_id', profileId)
            .eq('button_id', buttonId)
        );
      } else {
        // Create new override
        updates.push(
          supabaseAdmin
            .from('profile_buttons')
            .insert({
              profile_id: profileId,
              button_id: buttonId,
              is_enabled: validated.isEnabled ?? true,
              is_visible: validated.isVisible ?? true,
              custom_label: validated.customLabel || null,
              custom_icon: validated.customIcon || null,
            })
        );
      }
    }

    await Promise.all(updates);

    return NextResponse.json({
      success: true,
      message: 'Button permissions updated successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in PUT /api/profiles/[id]/button-permissions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

