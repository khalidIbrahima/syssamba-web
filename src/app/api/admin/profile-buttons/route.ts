import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { supabaseAdmin } from '@/lib/db';
import { z } from 'zod';

// Validation schema
const updateProfileButtonSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID'),
  buttonId: z.string().uuid('Invalid button ID'),
  isEnabled: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  customLabel: z.string().nullable().optional(),
  customIcon: z.string().nullable().optional(),
});

/**
 * GET /api/admin/profile-buttons
 * Get all profile button associations
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

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const buttonId = searchParams.get('buttonId');

    // Validate UUID format if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (profileId && (profileId === 'null' || profileId === 'undefined' || !uuidRegex.test(profileId))) {
      return NextResponse.json(
        { error: 'Invalid profile ID format' },
        { status: 400 }
      );
    }
    if (buttonId && (buttonId === 'null' || buttonId === 'undefined' || !uuidRegex.test(buttonId))) {
      return NextResponse.json(
        { error: 'Invalid button ID format' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('profile_buttons')
      .select('*');

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    if (buttonId) {
      query = query.eq('button_id', buttonId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching profile buttons:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile buttons' },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/admin/profile-buttons:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/profile-buttons
 * Create or update a profile button association
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
    const validatedData = updateProfileButtonSchema.parse(body);

    // Check if association already exists
    const { data: existing } = await supabaseAdmin
      .from('profile_buttons')
      .select('*')
      .eq('profile_id', validatedData.profileId)
      .eq('button_id', validatedData.buttonId)
      .single();

    const updateData: any = {};
    if (validatedData.isEnabled !== undefined) updateData.is_enabled = validatedData.isEnabled;
    if (validatedData.isVisible !== undefined) updateData.is_visible = validatedData.isVisible;
    if (validatedData.customLabel !== undefined) updateData.custom_label = validatedData.customLabel;
    if (validatedData.customIcon !== undefined) updateData.custom_icon = validatedData.customIcon;

    if (existing) {
      // Update existing association
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('profile_buttons')
        .update(updateData)
        .eq('profile_id', validatedData.profileId)
        .eq('button_id', validatedData.buttonId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating profile button:', updateError);
        return NextResponse.json(
          { error: 'Failed to update profile button', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Profile button updated successfully',
        item: updated,
      });
    } else {
      // Create new association
      const { data: created, error: createError } = await supabaseAdmin
        .from('profile_buttons')
        .insert({
          profile_id: validatedData.profileId,
          button_id: validatedData.buttonId,
          is_enabled: validatedData.isEnabled ?? true,
          is_visible: validatedData.isVisible ?? true,
          custom_label: validatedData.customLabel || null,
          custom_icon: validatedData.customIcon || null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile button:', createError);
        return NextResponse.json(
          { error: 'Failed to create profile button', details: createError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Profile button created successfully',
        item: created,
      }, { status: 201 });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in POST /api/admin/profile-buttons:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/profile-buttons
 * Update a profile button association
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
    const validatedData = updateProfileButtonSchema.parse(body);

    const updateData: any = {};
    if (validatedData.isEnabled !== undefined) updateData.is_enabled = validatedData.isEnabled;
    if (validatedData.isVisible !== undefined) updateData.is_visible = validatedData.isVisible;
    if (validatedData.customLabel !== undefined) updateData.custom_label = validatedData.customLabel;
    if (validatedData.customIcon !== undefined) updateData.custom_icon = validatedData.customIcon;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profile_buttons')
      .update(updateData)
      .eq('profile_id', validatedData.profileId)
      .eq('button_id', validatedData.buttonId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile button:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile button', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile button updated successfully',
      item: updated,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in PUT /api/admin/profile-buttons:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/profile-buttons
 * Delete a profile button association
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
    const profileId = searchParams.get('profileId');
    const buttonId = searchParams.get('buttonId');

    if (!profileId || !buttonId) {
      return NextResponse.json(
        { error: 'Profile ID and Button ID are required' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from('profile_buttons')
      .delete()
      .eq('profile_id', profileId)
      .eq('button_id', buttonId);

    if (deleteError) {
      console.error('Error deleting profile button:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete profile button', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile button deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/profile-buttons:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

