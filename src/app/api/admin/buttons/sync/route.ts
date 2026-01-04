import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { supabaseAdmin } from '@/lib/db';

/**
 * POST /api/admin/buttons/sync
 * Manually sync button permissions with object permissions for a specific profile
 * or all profiles
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
    const { profileId } = body;

    if (profileId) {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (profileId === 'null' || profileId === 'undefined' || !uuidRegex.test(profileId)) {
        return NextResponse.json(
          { error: 'Invalid profile ID format' },
          { status: 400 }
        );
      }

      // Sync for a specific profile
      const { data: permissions, error: permError } = await supabaseAdmin
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

      // Get all buttons
      const { data: buttons, error: buttonsError } = await supabaseAdmin
        .from('buttons')
        .select('id, object_type, action')
        .eq('is_active', true);

      if (buttonsError) {
        console.error('Error fetching buttons:', buttonsError);
        return NextResponse.json(
          { error: 'Failed to fetch buttons' },
          { status: 500 }
        );
      }

      // Sync buttons with permissions
      const syncOperations: Promise<any>[] = [];

      for (const permission of permissions || []) {
        for (const button of buttons || []) {
          if (button.object_type === permission.object_type) {
            let shouldEnable = false;

            // Map button action to object permission
            switch (button.action) {
              case 'create':
                shouldEnable = permission.can_create;
                break;
              case 'read':
              case 'view':
                shouldEnable = permission.can_read;
                break;
              case 'update':
              case 'edit':
                shouldEnable = permission.can_edit;
                break;
              case 'delete':
                shouldEnable = permission.can_delete;
                break;
              case 'export':
              case 'import':
              case 'print':
              case 'custom':
                shouldEnable = permission.can_read;
                break;
              default:
                shouldEnable = permission.can_read;
            }

            // Upsert profile_button
            syncOperations.push(
              (async () => {
                const { error } = await supabaseAdmin
                  .from('profile_buttons')
                  .upsert({
                    profile_id: profileId,
                    button_id: button.id,
                    is_enabled: shouldEnable,
                    is_visible: shouldEnable,
                  }, {
                    onConflict: 'profile_id,button_id',
                  });
                if (error) throw error;
              })()
            );
          }
        }
      }

      await Promise.all(syncOperations);

      return NextResponse.json({
        success: true,
        message: `Button permissions synced for profile ${profileId}`,
        syncedButtons: syncOperations.length,
      });
    } else {
      // Sync for all profiles
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('is_active', true);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return NextResponse.json(
          { error: 'Failed to fetch profiles' },
          { status: 500 }
        );
      }

      let totalSynced = 0;

      for (const profile of profiles || []) {
        const { data: permissions } = await supabaseAdmin
          .from('profile_object_permissions')
          .select('object_type, can_create, can_read, can_edit, can_delete')
          .eq('profile_id', profile.id);

        const { data: buttons } = await supabaseAdmin
          .from('buttons')
          .select('id, object_type, action')
          .eq('is_active', true);

        const syncOperations: Promise<any>[] = [];

        for (const permission of permissions || []) {
          for (const button of buttons || []) {
            if (button.object_type === permission.object_type) {
              let shouldEnable = false;

              switch (button.action) {
                case 'create':
                  shouldEnable = permission.can_create;
                  break;
                case 'read':
                case 'view':
                  shouldEnable = permission.can_read;
                  break;
                case 'update':
                case 'edit':
                  shouldEnable = permission.can_edit;
                  break;
                case 'delete':
                  shouldEnable = permission.can_delete;
                  break;
                case 'export':
                case 'import':
                case 'print':
                case 'custom':
                  shouldEnable = permission.can_read;
                  break;
                default:
                  shouldEnable = permission.can_read;
              }

              syncOperations.push(
                (async () => {
                  const { error } = await supabaseAdmin
                    .from('profile_buttons')
                    .upsert({
                      profile_id: profile.id,
                      button_id: button.id,
                      is_enabled: shouldEnable,
                      is_visible: shouldEnable,
                    }, {
                      onConflict: 'profile_id,button_id',
                    });
                  if (error) throw error;
                })()
              );
            }
          }
        }

        await Promise.all(syncOperations);
        totalSynced += syncOperations.length;
      }

      return NextResponse.json({
        success: true,
        message: `Button permissions synced for all profiles`,
        syncedProfiles: profiles?.length || 0,
        syncedButtons: totalSynced,
      });
    }
  } catch (error: any) {
    console.error('Error in POST /api/admin/buttons/sync:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

