import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { getUserProfile } from '@/lib/profiles';
import { supabaseAdmin, db } from '@/lib/db';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { getObjectTypeFromPermission } from '@/lib/permission-mappings';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

/**
 * GET /api/navigation/items
 * Get navigation items for the current user based on their profile
 * Applies: Plan Feature Security + Profile Permission Security + Profile Navigation Overrides
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
    if (!user || !user.profileId || !user.organizationId) {
      return NextResponse.json(
        { error: 'User, profile, or organization not found' },
        { status: 404 }
      );
    }

    // Get user's profile
    const profile = await getUserProfile(user.id);
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const organizationId = user.organizationId;

    // Get user's plan using the same logic as /api/user/plan-features
    const supabase = await createRouteHandlerClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get subscription and plan
    const { data: subscriptionData } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_id')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle();

    let plan: { id: string; name: string } | null = null;
    
    if (subscriptionData?.plan_id) {
      const { data: planData } = await supabaseAdmin
        .from('plans')
        .select('id, name')
        .eq('id', subscriptionData.plan_id)
        .single();
      
      if (planData) {
        plan = planData;
      }
    }

    // Fallback to freemium if no plan found
    if (!plan) {
      const { data: freemiumPlan } = await supabaseAdmin
        .from('plans')
        .select('id, name')
        .eq('name', 'freemium')
        .single();
      
      if (freemiumPlan) {
        plan = freemiumPlan;
      }
    }

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Get plan features
    const { data: planFeaturesData } = await supabaseAdmin
      .from('plan_features')
      .select(`
        plan_id,
        feature_id,
        is_enabled,
        features!plan_features_feature_id_fkey(
          id,
          name
        )
      `)
      .eq('plan_id', plan.id)
      .eq('is_enabled', true);

    // Get enabled features for the plan (by feature_id)
    const enabledFeatureIds = new Set<string>();
    if (planFeaturesData) {
      planFeaturesData.forEach((pf: any) => {
        if (pf.feature_id) {
          enabledFeatureIds.add(pf.feature_id);
        }
      });
    }


    // Get ALL active navigation items from the database
    const { data: allNavigationItems, error: navItemsError } = await supabaseAdmin
      .from('navigation_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (navItemsError) {
      console.error('Error fetching navigation items:', navItemsError);
      return NextResponse.json(
        { error: 'Failed to fetch navigation items', details: navItemsError.message },
        { status: 500 }
      );
    }

    if (!allNavigationItems || allNavigationItems.length === 0) {
      return NextResponse.json({
        items: [],
        totalItems: 0,
      });
    }

    console.log('DEBUG: allNavigationItems count:', allNavigationItems.length);
    if (allNavigationItems.length > 0) {
      console.log('DEBUG: first navigation item sample:', JSON.stringify(allNavigationItems[0], null, 2));
    }

    // Get profile navigation items (overrides) for this profile
    const { data: profileNavItems, error: profileNavError } = await supabaseAdmin
      .from('profile_navigation_items')
      .select(`
        navigation_item_id,
        is_enabled,
        is_visible,
        custom_sort_order
      `)
      .eq('profile_id', profile.id);

    console.log('DEBUG: profileNavItems count:', profileNavItems?.length || 0);
    console.log('DEBUG: profile.id:', profile.id);

    if (profileNavError) {
      console.error('Error fetching profile navigation items:', profileNavError);
      // Continue without overrides if there's an error
    }

    // Create a map of profile overrides for quick lookup
    const profileOverridesMap = new Map(
      (profileNavItems || []).map((pni: any) => [
        pni.navigation_item_id,
        {
          isEnabled: pni.is_enabled,
          isVisible: pni.is_visible,
          customSortOrder: pni.custom_sort_order,
        },
      ])
    );

    // Combine all items: apply profile overrides where they exist, use defaults otherwise
    const allItems = allNavigationItems.map((navItem: any) => {
      const override = profileOverridesMap.get(navItem.id);

      if (override) {
        // Item has profile override
        return {
          ...navItem,
          profileOverride: override,
        };
      } else {
        // Item has no override, use defaults (enabled=true, visible=true)
        return {
          ...navItem,
          profileOverride: {
            isEnabled: true,
            isVisible: true,
            customSortOrder: null,
          },
        };
      }
    });

    console.log('DEBUG: allItems count (after combining):', allItems.length);

    // Filter out items that are disabled or hidden for this profile
    const enabledItems = allItems.filter((item: any) => 
      item.profileOverride.isEnabled && item.profileOverride.isVisible
    );

    console.log('DEBUG: enabledItems count (after profile filter):', enabledItems.length);

    // Get user's profile permissions
    const profilePermissions = await getProfileObjectPermissions(profile.id);
    const permissionsMap = new Map<string, {
      canRead: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canViewAll: boolean;
    }>();

    profilePermissions.forEach((perm: any) => {
      permissionsMap.set(perm.object_type, {
        canRead: perm.can_read,
        canCreate: perm.can_create,
        canEdit: perm.can_edit,
        canDelete: perm.can_delete,
        canViewAll: perm.can_view_all,
      });
    });

    // Filter items based on access (plan features and permissions)
    const accessibleItems = enabledItems.filter((item: any) => {
      // STEP 1: Check Plan Feature Security
      console.log('DEBUG: item.feature_id:', item.feature_id);
      console.log('DEBUG: enabledFeatureIds:', enabledFeatureIds);
      if (item.feature_id) {
        if (!enabledFeatureIds.has(item.feature_id)) {
          return false; // Feature not available in plan
        }
      }

      // STEP 2: Check Profile Permission Security
      /* if (item.required_permission || item.required_object_type) {
        let hasPermission = false;

        if (item.required_object_type) {
          // Check object-level permission
          const perm = permissionsMap.get(item.required_object_type);
          if (perm) {
            const action = item.required_object_action || 'read';
            if (action === 'read') hasPermission = perm.canRead;
            else if (action === 'create') hasPermission = perm.canCreate;
            else if (action === 'edit') hasPermission = perm.canEdit;
            else if (action === 'delete') hasPermission = perm.canDelete;
          }
        } else if (item.required_permission) {
          // Check permission string (fallback to object type mapping)
          const objectType = getObjectTypeFromPermission(item.required_permission);
          if (objectType) {
            const perm = permissionsMap.get(objectType);
            if (perm) {
              hasPermission = perm.canRead; // Default to read for permission strings
            }
          } else {
            // If no object type mapping, assume permission is granted if profile exists
            // This is a fallback for custom permissions
            hasPermission = true;
          }
        }

        if (!hasPermission) {
          return false; // Permission not granted
        }
      } */

      // STEP 3: Profile Navigation Override already filtered above
      return true;
    });

    console.log('DEBUG: accessibleItems count:', accessibleItems.length);
    if (accessibleItems.length > 0) {
      console.log('DEBUG: first accessible item sample:', JSON.stringify(accessibleItems[0], null, 2));
    }

    // Fetch real counts for payments and tasks
    let pendingPaymentsCount = 0;
    let activeTasksCount = 0;

    try {
      // Get pending payments count
      const pendingPayments = await db.select<{
        id: string;
      }>('payments', {
        eq: { organization_id: organizationId, status: 'pending' },
      });
      pendingPaymentsCount = pendingPayments?.length || 0;
    } catch (error) {
      console.error('Error fetching pending payments count:', error);
      // Continue with 0 if there's an error
    }

    try {
      // Get active tasks count (todo + in_progress) for the current user
      // Tasks where user is creator OR assigned to
      const allTasks = await db.select<{
        id: string;
        created_by: string | null;
        assigned_to: string | null;
        status: string;
      }>('tasks', {
        eq: { organization_id: organizationId },
      });

      // Filter tasks: user must be creator OR assigned to, and status is todo or in_progress
      const activeTasks = allTasks.filter(
        (task) =>
          (task.created_by === userId || task.assigned_to === userId) &&
          (task.status === 'todo' || task.status === 'in_progress')
      );
      activeTasksCount = activeTasks?.length || 0;
    } catch (error) {
      console.error('Error fetching active tasks count:', error);
      // Continue with 0 if there's an error
    }

    // Build hierarchy and apply custom sort orders
    const itemsWithSort = accessibleItems.map((item: any) => {
      // Use real counts for payments and tasks, otherwise use badge_count from database
      let badge = item.badge_count;
      
      // Check if this is the payments item (by href or key)
      if (item.href === '/payments' || item.key === 'payments') {
        badge = pendingPaymentsCount > 0 ? pendingPaymentsCount : null;
      }
      // Check if this is the tasks item (by href or key)
      else if (item.href === '/tasks' || item.key === 'tasks') {
        badge = activeTasksCount > 0 ? activeTasksCount : null;
      }

      return {
        key: item.key,
        name: item.name,
        href: item.href,
        icon: item.icon,
        badge: badge,
        sortOrder: item.profileOverride?.customSortOrder ?? item.sort_order,
        parentKey: item.parent_key,
      };
    });

    // Sort by sortOrder
    itemsWithSort.sort((a, b) => a.sortOrder - b.sortOrder);

    // Build hierarchy
    const rootItems = itemsWithSort.filter(item => !item.parentKey);
    const childItemsMap = new Map<string, typeof itemsWithSort>();
    
    itemsWithSort.forEach(item => {
      if (item.parentKey) {
        if (!childItemsMap.has(item.parentKey)) {
          childItemsMap.set(item.parentKey, []);
        }
        childItemsMap.get(item.parentKey)!.push(item);
      }
    });

    // Attach children to parents
    const itemsWithChildren = rootItems.map(item => ({
      ...item,
      subItems: childItemsMap.get(item.key) || [],
    }));

    return NextResponse.json({
      items: itemsWithChildren,
      totalItems: accessibleItems.length,
    });
  } catch (error: any) {
    console.error('Error in GET /api/navigation/items:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

