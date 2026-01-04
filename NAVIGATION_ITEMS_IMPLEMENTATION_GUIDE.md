# Guide d'Implémentation: Navigation Items Database System

## Vue d'ensemble

Ce système permet de gérer dynamiquement les éléments de navigation de la sidebar via la base de données, avec liaison aux profils pour une personnalisation fine.

## Architecture

### Tables Créées

1. **`navigation_items`** : Définit tous les items de navigation disponibles
2. **`profile_navigation_items`** : Liaison profil ↔ item (activation/désactivation par profil)
3. **`organization_navigation_items`** : Liaison organisation ↔ item (personnalisation multi-tenant)

### Sécurité à Deux Niveaux

Chaque item nécessite **BOTH** :
- ✅ **Plan Feature Security** : Feature activée dans le plan
- ✅ **Profile Permission Security** : Permission accordée dans le profil

## Avantages

### ✅ Flexibilité Maximale
- Ajouter/modifier/supprimer des items sans déploiement
- Personnalisation par profil et par organisation
- Configuration via interface admin

### ✅ Sécurité Renforcée
- Double vérification (Plan + Profile)
- Override par profil/organisation
- Audit trail avec timestamps

### ✅ Scalabilité
- Support multi-tenant
- Performance optimisée avec index
- Gestion centralisée

## Exemple d'API Route

### `/api/navigation/items`

```typescript
// src/app/api/navigation/items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserProfile } from '@/lib/profiles';
import { db } from '@/lib/db';
import { canAccessNavigationItem } from '@/lib/navigation-access';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile and organization
    const profile = await getUserProfile(user.id);
    const organization = await getUserOrganization(user.id);
    const plan = await getOrganizationPlan(organization.id);

    // Fetch all active navigation items
    const allItems = await db.select<{
      id: string;
      key: string;
      name: string;
      href: string;
      icon: string | null;
      badge_count: number | null;
      sort_order: number;
      required_feature_key: string | null;
      required_permission: string | null;
      required_object_type: string | null;
      required_object_action: string;
      parent_key: string | null;
      is_active: boolean;
    }>('navigation_items', {
      eq: { is_active: true },
      orderBy: { column: 'sort_order', ascending: true },
    });

    // Filter by access (Plan Feature + Profile Permission)
    const accessibleItems = allItems.filter(item => 
      canAccessNavigationItem(item, plan, profile, organization)
    );

    // Apply profile and organization overrides
    const finalItems = await applyNavigationOverrides(
      accessibleItems,
      profile.id,
      organization.id
    );

    // Build hierarchy (parent/children)
    const itemsWithChildren = buildNavigationHierarchy(finalItems);

    return NextResponse.json({ items: itemsWithChildren });
  } catch (error) {
    console.error('Error fetching navigation items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Fonction de Vérification d'Accès

```typescript
// src/lib/navigation-access.ts
export async function canAccessNavigationItem(
  item: NavigationItem,
  plan: Plan,
  profile: Profile,
  organization: Organization
): Promise<boolean> {
  // STEP 1: Check Plan Feature Security
  if (item.required_feature_key) {
    const featureEnabled = await isFeatureEnabledInPlan(plan, item.required_feature_key);
    if (!featureEnabled) {
      return false; // Feature not available in plan
    }
  }

  // STEP 2: Check Profile Permission Security
  if (item.required_permission || item.required_object_type) {
    const hasPermission = await checkProfilePermission(
      profile,
      item.required_permission,
      item.required_object_type,
      item.required_object_action || 'read'
    );
    if (!hasPermission) {
      return false; // Permission not granted in profile
    }
  }

  // STEP 3: Check Profile Navigation Override
  const profileNavItem = await db.selectOne('profile_navigation_items', {
    eq: {
      profile_id: profile.id,
      navigation_item_key: item.key,
    },
  });
  if (profileNavItem && !profileNavItem.is_enabled) {
    return false; // Disabled for this profile
  }

  // STEP 4: Check Organization Navigation Override
  const orgNavItem = await db.selectOne('organization_navigation_items', {
    eq: {
      organization_id: organization.id,
      navigation_item_key: item.key,
    },
  });
  if (orgNavItem && !orgNavItem.is_enabled) {
    return false; // Disabled for this organization
  }

  // All checks passed
  return true;
}
```

## Migration depuis Configuration Statique

### Étape 1: Exécuter la migration SQL
```bash
psql -d your_database -f init-db/62-create-navigation-items-system.sql
```

### Étape 2: Mettre à jour la Sidebar
Remplacer `navigationItems` statique par un appel API :

```typescript
// Avant (statique)
const navigationItems: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', ... },
  // ...
];

// Après (dynamique)
const { data: navigationItems } = useDataQuery(
  ['navigation-items'],
  async () => {
    const response = await fetch('/api/navigation/items', {
      credentials: 'include',
    });
    return response.json();
  }
);
```

## Interface Admin

Créer `/admin/navigation-items` pour :
- ✅ Gérer les items de navigation
- ✅ Configurer les permissions par profil
- ✅ Personnaliser par organisation
- ✅ Prévisualiser la navigation

## Conclusion

Cette approche offre une **flexibilité maximale** tout en maintenant la **sécurité à deux niveaux** (Plan + Profile). Elle permet une **gestion dynamique** sans compromettre la sécurité.

