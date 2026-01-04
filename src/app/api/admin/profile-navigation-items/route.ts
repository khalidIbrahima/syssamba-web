import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { supabaseAdmin } from '@/lib/db';
import { z } from 'zod';

// Validation schema
const updateProfileNavigationItemSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID'),
  navigationItemId: z.string().uuid('Invalid navigation item ID'),
  isEnabled: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  customSortOrder: z.number().nullable().optional(),
});

/**
 * GET /api/admin/profile-navigation-items
 * Get all profile navigation item associations
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

    let query = supabaseAdmin
      .from('profile_navigation_items')
      .select('*');

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching profile navigation items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile navigation items' },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/admin/profile-navigation-items:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/profile-navigation-items
 * Create or update a profile navigation item association
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
    const validatedData = updateProfileNavigationItemSchema.parse(body);

    // Check if association already exists
    const { data: existing } = await supabaseAdmin
      .from('profile_navigation_items')
      .select('*')
      .eq('profile_id', validatedData.profileId)
      .eq('navigation_item_id', validatedData.navigationItemId)
      .single();

    const updateData: any = {};
    if (validatedData.isEnabled !== undefined) updateData.is_enabled = validatedData.isEnabled;
    if (validatedData.isVisible !== undefined) updateData.is_visible = validatedData.isVisible;
    if (validatedData.customSortOrder !== undefined) updateData.custom_sort_order = validatedData.customSortOrder;

    if (existing) {
      // Update existing association
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('profile_navigation_items')
        .update(updateData)
        .eq('profile_id', validatedData.profileId)
        .eq('navigation_item_id', validatedData.navigationItemId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating profile navigation item:', updateError);
        return NextResponse.json(
          { error: 'Failed to update profile navigation item', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Profile navigation item updated successfully',
        item: updated,
      });
    } else {
      // Create new association
      const { data: created, error: createError } = await supabaseAdmin
        .from('profile_navigation_items')
        .insert({
          profile_id: validatedData.profileId,
          navigation_item_id: validatedData.navigationItemId,
          is_enabled: validatedData.isEnabled ?? true,
          is_visible: validatedData.isVisible ?? true,
          custom_sort_order: validatedData.customSortOrder ?? null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile navigation item:', createError);
        return NextResponse.json(
          { error: 'Failed to create profile navigation item', details: createError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Profile navigation item created successfully',
        item: created,
      });
    }
  } catch (error: any) {
    console.error('Error in POST /api/admin/profile-navigation-items:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/profile-navigation-items
 * Bulk update profile navigation items for a profile
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
    const schema = z.object({
      profileId: z.string().uuid('Invalid profile ID'),
      items: z.array(z.object({
        navigationItemId: z.string().uuid('Invalid navigation item ID'),
        isEnabled: z.boolean().optional(),
        isVisible: z.boolean().optional(),
        customSortOrder: z.number().nullable().optional(),
      })),
    });

    const validatedData = schema.parse(body);

    // Delete existing associations for this profile
    await supabaseAdmin
      .from('profile_navigation_items')
      .delete()
      .eq('profile_id', validatedData.profileId);

    // Insert new associations
    const associations = validatedData.items.map(item => ({
      profile_id: validatedData.profileId,
      navigation_item_id: item.navigationItemId,
      is_enabled: item.isEnabled ?? true,
      is_visible: item.isVisible ?? true,
      custom_sort_order: item.customSortOrder ?? null,
    }));

    const { data: created, error: createError } = await supabaseAdmin
      .from('profile_navigation_items')
      .insert(associations)
      .select();

    if (createError) {
      console.error('Error bulk updating profile navigation items:', createError);
      return NextResponse.json(
        { error: 'Failed to bulk update profile navigation items', details: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile navigation items updated successfully',
      items: created,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/admin/profile-navigation-items:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/profile-navigation-items
 * Delete a profile navigation item association
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
    const navigationItemId = searchParams.get('navigationItemId');

    if (!profileId || !navigationItemId) {
      return NextResponse.json(
        { error: 'Profile ID and Navigation Item ID are required' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from('profile_navigation_items')
      .delete()
      .eq('profile_id', profileId)
      .eq('navigation_item_id', navigationItemId);

    if (deleteError) {
      console.error('Error deleting profile navigation item:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete profile navigation item', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile navigation item deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/profile-navigation-items:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

