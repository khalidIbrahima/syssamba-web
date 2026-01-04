import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db, supabaseAdmin } from '@/lib/db';
import { z } from 'zod';

// Validation schemas
const createNavigationItemSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  name: z.string().min(1, 'Name is required'),
  href: z.string().min(1, 'Href is required'),
  icon: z.string().optional(),
  badgeCount: z.number().nullable().optional(),
  sortOrder: z.number().default(0),
  featureId: z.string().uuid().nullable().optional(),
  requiredPermission: z.string().optional(),
  requiredObjectType: z.string().optional(),
  requiredObjectAction: z.enum(['read', 'create', 'edit', 'delete']).default('read'),
  parentKey: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  isSystemItem: z.boolean().default(false),
  description: z.string().optional(),
});

const updateNavigationItemSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  name: z.string().min(1, 'Name is required').optional(),
  href: z.string().min(1, 'Href is required').optional(),
  icon: z.string().nullable().optional(),
  badgeCount: z.number().nullable().optional(),
  sortOrder: z.number().optional(),
  featureId: z.string().uuid().nullable().optional(),
  requiredPermission: z.string().nullable().optional(),
  requiredObjectType: z.string().nullable().optional(),
  requiredObjectAction: z.enum(['read', 'create', 'edit', 'delete']).optional(),
  parentKey: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

const updateProfileNavigationItemSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID'),
  navigationItemKey: z.string().min(1, 'Navigation item key is required'),
  isEnabled: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  customSortOrder: z.number().nullable().optional(),
});

/**
 * GET /api/admin/navigation-items
 * Get all navigation items with their profile associations
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

    // Get all navigation items
    const { data: navigationItems, error: itemsError } = await supabaseAdmin
      .from('navigation_items')
      .select('*')
      .order('sort_order', { ascending: true });

    if (itemsError) {
      console.error('Error fetching navigation items:', itemsError);
      return NextResponse.json(
        { error: 'Failed to fetch navigation items' },
        { status: 500 }
      );
    }

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, display_name, organization_id')
      .order('name', { ascending: true });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    // Get all profile navigation items associations
    const { data: profileNavItems, error: profileNavError } = await supabaseAdmin
      .from('profile_navigation_items')
      .select('*');

    if (profileNavError) {
      console.error('Error fetching profile navigation items:', profileNavError);
      return NextResponse.json(
        { error: 'Failed to fetch profile navigation items' },
        { status: 500 }
      );
    }

    // Build result structure similar to plan-features
    const result = {
      navigationItems: navigationItems || [],
      profiles: profiles || [],
      profileNavigationItems: profileNavItems || [],
      totalItems: navigationItems?.length || 0,
      totalProfiles: profiles?.length || 0,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/admin/navigation-items:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/navigation-items
 * Create a new navigation item
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
    const validatedData = createNavigationItemSchema.parse(body);

    // Check if key already exists
    const { data: existingItem } = await supabaseAdmin
      .from('navigation_items')
      .select('key')
      .eq('key', validatedData.key)
      .single();

    if (existingItem) {
      return NextResponse.json(
        { error: 'Navigation item with this key already exists' },
        { status: 400 }
      );
    }

    // Insert new navigation item
    const { data: newItem, error: insertError } = await supabaseAdmin
      .from('navigation_items')
      .insert({
        key: validatedData.key,
        name: validatedData.name,
        href: validatedData.href,
        icon: validatedData.icon || null,
        badge_count: validatedData.badgeCount ?? null,
        sort_order: validatedData.sortOrder,
        feature_id: validatedData.featureId || null,
        required_permission: validatedData.requiredPermission || null,
        required_object_type: validatedData.requiredObjectType || null,
        required_object_action: validatedData.requiredObjectAction,
        parent_key: validatedData.parentKey || null,
        is_active: validatedData.isActive,
        is_system_item: validatedData.isSystemItem,
        description: validatedData.description || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating navigation item:', insertError);
      return NextResponse.json(
        { error: 'Failed to create navigation item', details: insertError.message },
        { status: 500 }
      );
    }

    // If not a system item, create associations for all existing profiles
    if (!validatedData.isSystemItem) {
      const { data: allProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id');

      if (allProfiles && allProfiles.length > 0) {
        const profileAssociations = allProfiles.map(profile => ({
          profile_id: profile.id,
          navigation_item_id: newItem.id,
          is_enabled: true,
          is_visible: true,
        }));

        await supabaseAdmin
          .from('profile_navigation_items')
          .insert(profileAssociations);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Navigation item created successfully',
      item: newItem,
    });
  } catch (error: any) {
    console.error('Error creating navigation item:', error);

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
 * PATCH /api/admin/navigation-items
 * Update an existing navigation item
 */
export async function PATCH(request: NextRequest) {
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
    const validatedData = updateNavigationItemSchema.parse(body);

    // Check if item exists
    const { data: existingItem } = await supabaseAdmin
      .from('navigation_items')
      .select('*')
      .eq('key', validatedData.key)
      .single();

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Navigation item not found' },
        { status: 404 }
      );
    }

    // Don't allow updating system items (except certain fields)
    if (existingItem.is_system_item) {
      // Only allow updating: name, description, sort_order, badge_count, is_active
      const allowedFields = ['name', 'description', 'sort_order', 'badge_count', 'is_active'];
      const updateData: any = {};
      
      if (validatedData.name !== undefined) updateData.name = validatedData.name;
      if (validatedData.description !== undefined) updateData.description = validatedData.description;
      if (validatedData.sortOrder !== undefined) updateData.sort_order = validatedData.sortOrder;
      if (validatedData.badgeCount !== undefined) updateData.badge_count = validatedData.badgeCount;
      if (validatedData.isActive !== undefined) updateData.is_active = validatedData.isActive;

      const { data: updatedItem, error: updateError } = await supabaseAdmin
        .from('navigation_items')
        .update(updateData)
        .eq('key', validatedData.key)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating navigation item:', updateError);
        return NextResponse.json(
          { error: 'Failed to update navigation item', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Navigation item updated successfully',
        item: updatedItem,
      });
    }

    // For non-system items, allow full update
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.href !== undefined) updateData.href = validatedData.href;
    if (validatedData.icon !== undefined) updateData.icon = validatedData.icon;
    if (validatedData.badgeCount !== undefined) updateData.badge_count = validatedData.badgeCount;
    if (validatedData.sortOrder !== undefined) updateData.sort_order = validatedData.sortOrder;
    if (validatedData.featureId !== undefined) updateData.feature_id = validatedData.featureId;
    if (validatedData.requiredPermission !== undefined) updateData.required_permission = validatedData.requiredPermission;
    if (validatedData.requiredObjectType !== undefined) updateData.required_object_type = validatedData.requiredObjectType;
    if (validatedData.requiredObjectAction !== undefined) updateData.required_object_action = validatedData.requiredObjectAction;
    if (validatedData.parentKey !== undefined) updateData.parent_key = validatedData.parentKey;
    if (validatedData.isActive !== undefined) updateData.is_active = validatedData.isActive;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;

    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from('navigation_items')
      .update(updateData)
      .eq('key', validatedData.key)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating navigation item:', updateError);
      return NextResponse.json(
        { error: 'Failed to update navigation item', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Navigation item updated successfully',
      item: updatedItem,
    });
  } catch (error: any) {
    console.error('Error updating navigation item:', error);

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
 * DELETE /api/admin/navigation-items
 * Delete a navigation item (only non-system items)
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
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Navigation item key is required' },
        { status: 400 }
      );
    }

    // Check if item exists and is not a system item
    const { data: existingItem } = await supabaseAdmin
      .from('navigation_items')
      .select('is_system_item')
      .eq('key', key)
      .single();

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Navigation item not found' },
        { status: 404 }
      );
    }

    if (existingItem.is_system_item) {
      return NextResponse.json(
        { error: 'Cannot delete system navigation items' },
        { status: 400 }
      );
    }

    // Delete the item (cascade will handle profile_navigation_items)
    const { error: deleteError } = await supabaseAdmin
      .from('navigation_items')
      .delete()
      .eq('key', key);

    if (deleteError) {
      console.error('Error deleting navigation item:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete navigation item', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Navigation item deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting navigation item:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

