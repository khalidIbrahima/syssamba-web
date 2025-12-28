/**
 * Profiles Management System
 * Inspired by Salesforce Profiles
 * 
 * Each user has a profile that defines their base permissions (OLS and FLS)
 */

import { db } from './db';
import type { ObjectType } from './salesforce-inspired-security';

export interface Profile {
  id: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  isSystemProfile: boolean;
  isGlobal: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileObjectPermission {
  id: string;
  profileId: string;
  objectType: ObjectType;
  accessLevel: 'None' | 'Read' | 'ReadWrite' | 'All';
  canCreate: boolean;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewAll: boolean;
}

export interface ProfileFieldPermission {
  id: string;
  profileId: string;
  objectType: ObjectType;
  fieldName: string;
  accessLevel: 'None' | 'Read' | 'ReadWrite';
  canRead: boolean;
  canEdit: boolean;
  isSensitive: boolean;
}

/**
 * Get all profiles for an organization
 * Returns both organization-specific profiles and global system profiles
 * @param organizationId - If provided, returns profiles for that organization + global profiles. If null and getAll is false, returns only global profiles. If getAll is true, returns all profiles from all organizations.
 * @param getAll - If true, returns all profiles from all organizations (for super admin)
 */
export async function getProfiles(organizationId: string | null = null, getAll: boolean = false): Promise<Profile[]> {
  try {
    let allProfiles: Array<{
      id: string;
      organization_id: string | null;
      name: string;
      description: string | null;
      is_system_profile: boolean;
      is_global: boolean | null;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }> = [];

    if (getAll) {
      // Get ALL profiles from all organizations (for super admin)
      allProfiles = await db.select<{
        id: string;
        organization_id: string | null;
        name: string;
        description: string | null;
        is_system_profile: boolean;
        is_global: boolean | null;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
      }>('profiles', {
        orderBy: { column: 'name', ascending: true },
      });
    } else {
      // Get organization-specific profiles
      const orgProfiles = organizationId 
        ? await db.select<{
            id: string;
            organization_id: string | null;
            name: string;
            description: string | null;
            is_system_profile: boolean;
            is_global: boolean | null;
            is_active: boolean;
            created_at: Date;
            updated_at: Date;
          }>('profiles', {
            eq: { organization_id: organizationId },
            orderBy: { column: 'name', ascending: true },
          })
        : [];
      
      // Get global system profiles (organization_id IS NULL)
      const globalProfiles = await db.select<{
        id: string;
        organization_id: string | null;
        name: string;
        description: string | null;
        is_system_profile: boolean;
        is_global: boolean | null;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
      }>('profiles', {
        eq: { organization_id: null },
        orderBy: { column: 'name', ascending: true },
      });
      
      // Combine both lists
      allProfiles = [...globalProfiles, ...orgProfiles];
    }
    
    const mappedProfiles = allProfiles.map(p => ({
      id: p.id,
      organizationId: p.organization_id,
      name: p.name,
      description: p.description,
      isSystemProfile: p.is_system_profile,
      isGlobal: p.is_global || p.organization_id === null,
      isActive: p.is_active,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return mappedProfiles;
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
}

/**
 * Get a single profile by ID
 */
export async function getProfile(profileId: string): Promise<Profile | null> {
  try {
    const profile = await db.selectOne<{
      id: string;
      organization_id: string | null;
      name: string;
      description: string | null;
      is_system_profile: boolean;
      is_global: boolean;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>('profiles', {
      eq: { id: profileId },
    });

    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      organizationId: profile.organization_id,
      name: profile.name,
      description: profile.description,
      isSystemProfile: profile.is_system_profile,
      isGlobal: profile.is_global,
      isActive: profile.is_active,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

/**
 * Get object-level permissions for a profile
 */
export async function getProfileObjectPermissions(profileId: string): Promise<ProfileObjectPermission[]> {
  try {
    const permissions = await db.select<{
      id: string;
      profile_id: string;
      object_type: string;
      access_level: string;
      can_create: boolean;
      can_read: boolean;
      can_edit: boolean;
      can_delete: boolean;
      can_view_all: boolean;
    }>('profile_object_permissions', {
      eq: { profile_id: profileId },
    });

    return permissions.map(p => ({
      id: p.id,
      profileId: p.profile_id,
      objectType: p.object_type as ObjectType,
      accessLevel: p.access_level as 'None' | 'Read' | 'ReadWrite' | 'All',
      canCreate: p.can_create,
      canRead: p.can_read,
      canEdit: p.can_edit,
      canDelete: p.can_delete,
      canViewAll: p.can_view_all,
    }));
  } catch (error) {
    console.error('Error fetching profile object permissions:', error);
    return [];
  }
}

/**
 * Get field-level permissions for a profile
 */
export async function getProfileFieldPermissions(
  profileId: string,
  objectType?: ObjectType
): Promise<ProfileFieldPermission[]> {
  try {
    const filter: any = { profile_id: profileId };
    if (objectType) {
      filter.object_type = objectType;
    }

    const permissions = await db.select<{
      id: string;
      profile_id: string;
      object_type: string;
      field_name: string;
      access_level: string;
      can_read: boolean;
      can_edit: boolean;
      is_sensitive: boolean;
    }>('profile_field_permissions', {
      ...filter,
    });

    return permissions.map(p => ({
      id: p.id,
      profileId: p.profile_id,
      objectType: p.object_type as ObjectType,
      fieldName: p.field_name,
      accessLevel: p.access_level as 'None' | 'Read' | 'ReadWrite',
      canRead: p.can_read,
      canEdit: p.can_edit,
      isSensitive: p.is_sensitive,
    }));
  } catch (error) {
    console.error('Error fetching profile field permissions:', error);
    return [];
  }
}

/**
 * Create default profiles for a new organization
 * Creates Owner, Accountant, Agent, and Viewer profiles with comprehensive permissions
 */
export async function createDefaultProfilesForOrganization(organizationId: string): Promise<void> {
  try {
    // Define default profiles with their permissions
    const defaultProfiles = [
      {
        name: 'Propriétaire',
        description: 'Profil propriétaire avec accès complet',
        role: 'owner',
        permissions: {
          Property: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          Unit: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          Tenant: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          Lease: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          Payment: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          Task: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          Message: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          JournalEntry: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          User: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: false },
          Organization: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: false },
          Profile: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: false },
        }
      },
      {
        name: 'Comptable',
        description: 'Profil comptable avec accès aux données financières',
        role: 'accountant',
        permissions: {
          Property: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Unit: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Tenant: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Lease: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Payment: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          Task: { accessLevel: 'ReadWrite' as const, canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
          Message: { accessLevel: 'ReadWrite' as const, canCreate: true, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          JournalEntry: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          User: { accessLevel: 'None' as const, canCreate: false, canRead: false, canEdit: false, canDelete: false, canViewAll: false },
          Organization: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: false },
          Profile: { accessLevel: 'None' as const, canCreate: false, canRead: false, canEdit: false, canDelete: false, canViewAll: false },
        }
      },
      {
        name: 'Agent',
        description: 'Profil agent avec accès opérationnel',
        role: 'agent',
        permissions: {
          Property: { accessLevel: 'ReadWrite' as const, canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
          Unit: { accessLevel: 'ReadWrite' as const, canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
          Tenant: { accessLevel: 'ReadWrite' as const, canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
          Lease: { accessLevel: 'ReadWrite' as const, canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
          Payment: { accessLevel: 'ReadWrite' as const, canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
          Task: { accessLevel: 'ReadWrite' as const, canCreate: true, canRead: true, canEdit: true, canDelete: false, canViewAll: true },
          Message: { accessLevel: 'All' as const, canCreate: true, canRead: true, canEdit: true, canDelete: true, canViewAll: true },
          JournalEntry: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          User: { accessLevel: 'None' as const, canCreate: false, canRead: false, canEdit: false, canDelete: false, canViewAll: false },
          Organization: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: false },
          Profile: { accessLevel: 'None' as const, canCreate: false, canRead: false, canEdit: false, canDelete: false, canViewAll: false },
        }
      },
      {
        name: 'Lecteur',
        description: 'Profil lecteur avec accès en lecture seule',
        role: 'viewer',
        permissions: {
          Property: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Unit: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Tenant: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Lease: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Payment: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Task: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          Message: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          JournalEntry: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: true },
          User: { accessLevel: 'None' as const, canCreate: false, canRead: false, canEdit: false, canDelete: false, canViewAll: false },
          Organization: { accessLevel: 'Read' as const, canCreate: false, canRead: true, canEdit: false, canDelete: false, canViewAll: false },
          Profile: { accessLevel: 'None' as const, canCreate: false, canRead: false, canEdit: false, canDelete: false, canViewAll: false },
        }
      },
    ];

    // Create each profile and set permissions
    for (const profileDef of defaultProfiles) {
      // Check if profile already exists
      const existing = await db.selectOne<{ id: string }>('profiles', {
        eq: {
          organization_id: organizationId,
          name: profileDef.name,
        },
      });

      let profileId: string;

      if (existing) {
        profileId = existing.id;
        console.log(`Profile ${profileDef.name} already exists, updating permissions`);
      } else {
        // Create profile
        const newProfile = await db.insertOne<{
          id: string;
          organization_id: string | null;
          name: string;
          description: string | null;
          is_system_profile: boolean;
          is_global: boolean;
          is_active: boolean;
          created_at: Date;
          updated_at: Date;
        }>('profiles', {
          organization_id: organizationId,
          name: profileDef.name,
          description: profileDef.description,
          is_system_profile: true, // These are system profiles
          is_global: false, // Organization-specific
          is_active: true,
        });

        if (!newProfile) {
          throw new Error(`Failed to create profile ${profileDef.name}`);
        }

        profileId = newProfile.id;
        console.log(`Created profile ${profileDef.name} with ID ${profileId}`);
      }

      // Set permissions for this profile
      for (const [objectType, permission] of Object.entries(profileDef.permissions)) {
        await setProfileObjectPermission(profileId, objectType as ObjectType, permission);
      }

      console.log(`Set permissions for profile ${profileDef.name}`);
    }

    console.log(`Created/updated default profiles and permissions for organization ${organizationId}`);
  } catch (error) {
    console.error('Error creating default profiles for organization:', error);
    throw error;
  }
}

/**
 * Create a new profile
 */
export async function createProfile(
  organizationId: string,
  name: string,
  description?: string
): Promise<Profile | null> {
  try {
    const profile = await db.insertOne<{
      id: string;
      organization_id: string | null;
      name: string;
      description: string | null;
      is_system_profile: boolean;
      is_global: boolean;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>('profiles', {
      organization_id: organizationId,
      name,
      description: description || null,
      is_system_profile: false,
      is_global: false,
      is_active: true,
    });

    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      organizationId: profile.organization_id,
      name: profile.name,
      description: profile.description,
      isSystemProfile: profile.is_system_profile,
      isGlobal: profile.is_global,
      isActive: profile.is_active,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  } catch (error) {
    console.error('Error creating profile:', error);
    return null;
  }
}

/**
 * Update a profile
 */
export async function updateProfile(
  profileId: string,
  updates: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }
): Promise<boolean> {
  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    updateData.updated_at = new Date();

    await db.updateOne('profiles', updateData, { id: profileId });
    return true;
  } catch (error) {
    console.error('Error updating profile:', error);
    return false;
  }
}

/**
 * Delete a profile (only if not a system profile and no users assigned)
 */
export async function deleteProfile(profileId: string): Promise<boolean> {
  try {
    // Check if it's a system profile
    const profile = await db.selectOne<{
      is_system_profile: boolean;
    }>('profiles', {
      eq: { id: profileId },
    });

    if (!profile) {
      return false;
    }

    if (profile.is_system_profile) {
      throw new Error('Cannot delete system profile');
    }

    // Check if any users are using this profile
    const usersWithProfile = await db.count('users', {
      profile_id: profileId,
    });

    if (usersWithProfile > 0) {
      throw new Error('Cannot delete profile: users are assigned to it');
    }

    await db.deleteOne('profiles', { id: profileId });
    return true;
  } catch (error) {
    console.error('Error deleting profile:', error);
    throw error;
  }
}

/**
 * Set object-level permission for a profile
 */
export async function setProfileObjectPermission(
  profileId: string,
  objectType: ObjectType,
  permission: {
    accessLevel: 'None' | 'Read' | 'ReadWrite' | 'All';
    canCreate: boolean;
    canRead: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canViewAll: boolean;
  }
): Promise<boolean> {
  try {
    // Check if permission already exists
    const existing = await db.selectOne<{
      id: string;
    }>('profile_object_permissions', {
      eq: { profile_id: profileId, object_type: objectType },
    });

    if (existing) {
      // Update existing permission
      await db.updateOne(
        'profile_object_permissions',
        {
          access_level: permission.accessLevel,
          can_create: permission.canCreate,
          can_read: permission.canRead,
          can_edit: permission.canEdit,
          can_delete: permission.canDelete,
          can_view_all: permission.canViewAll,
          updated_at: new Date(),
        },
        { id: existing.id }
      );
    } else {
      // Create new permission
      await db.insertOne('profile_object_permissions', {
        profile_id: profileId,
        object_type: objectType,
        access_level: permission.accessLevel,
        can_create: permission.canCreate,
        can_read: permission.canRead,
        can_edit: permission.canEdit,
        can_delete: permission.canDelete,
        can_view_all: permission.canViewAll,
      });
    }

    return true;
  } catch (error) {
    console.error('Error setting profile object permission:', error);
    return false;
  }
}

/**
 * Set field-level permission for a profile
 */
export async function setProfileFieldPermission(
  profileId: string,
  objectType: ObjectType,
  fieldName: string,
  permission: {
    accessLevel: 'None' | 'Read' | 'ReadWrite';
    canRead: boolean;
    canEdit: boolean;
    isSensitive?: boolean;
  }
): Promise<boolean> {
  try {
    // Check if permission already exists
    const existing = await db.selectOne<{
      id: string;
    }>('profile_field_permissions', {
      eq: { 
        profile_id: profileId, 
        object_type: objectType,
        field_name: fieldName,
      },
    });

    if (existing) {
      // Update existing permission
      await db.updateOne(
        'profile_field_permissions',
        {
          access_level: permission.accessLevel,
          can_read: permission.canRead,
          can_edit: permission.canEdit,
          is_sensitive: permission.isSensitive || false,
          updated_at: new Date(),
        },
        { id: existing.id }
      );
    } else {
      // Create new permission
      await db.insertOne('profile_field_permissions', {
        profile_id: profileId,
        object_type: objectType,
        field_name: fieldName,
        access_level: permission.accessLevel,
        can_read: permission.canRead,
        can_edit: permission.canEdit,
        is_sensitive: permission.isSensitive || false,
      });
    }

    return true;
  } catch (error) {
    console.error('Error setting profile field permission:', error);
    return false;
  }
}

/**
 * Get user's profile
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  try {
    const user = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: userId },
    });

    if (!user || !user.profile_id) {
      return null;
    }

    return getProfile(user.profile_id);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Assign a profile to a user
 */
export async function assignProfileToUser(userId: string, profileId: string): Promise<boolean> {
  try {
    await db.updateOne('users', { profile_id: profileId }, { id: userId });
    return true;
  } catch (error) {
    console.error('Error assigning profile to user:', error);
    return false;
  }
}
