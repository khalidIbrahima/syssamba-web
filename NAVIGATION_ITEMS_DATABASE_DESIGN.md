# Design: Navigation Items Database Schema

## Concept

Créer une table pour gérer dynamiquement les éléments de navigation de la sidebar et les lier aux profils. Cela permet :
- ✅ Configuration dynamique sans déploiement de code
- ✅ Personnalisation par profil
- ✅ Gestion via interface admin
- ✅ Support multi-tenant (navigation par organisation)

## Schéma de Base de Données

### 1. Table `navigation_items`

Définit tous les éléments de navigation disponibles dans l'application.

```sql
CREATE TABLE navigation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    key TEXT NOT NULL UNIQUE, -- e.g., 'dashboard', 'properties', 'tasks'
    name TEXT NOT NULL, -- Nom d'affichage (e.g., 'Dashboard', 'Biens')
    href TEXT NOT NULL, -- Route (e.g., '/dashboard', '/properties')
    
    -- Métadonnées UI
    icon TEXT, -- Nom de l'icône (e.g., 'LayoutDashboard', 'Building2')
    badge_count INTEGER DEFAULT NULL, -- Nombre pour badge (null = pas de badge)
    sort_order INTEGER DEFAULT 0, -- Ordre d'affichage
    
    -- Sécurité Plan (Feature Level)
    required_feature_key TEXT REFERENCES features(name), -- Feature requise du plan (nullable)
    
    -- Sécurité Profile (Permission Level)
    required_permission TEXT, -- Permission requise (e.g., 'canViewAllProperties')
    required_object_type TEXT, -- Object type pour permission (e.g., 'Property')
    required_object_action TEXT DEFAULT 'read' CHECK (required_object_action IN ('read', 'create', 'edit', 'delete')),
    
    -- Hiérarchie
    parent_key TEXT REFERENCES navigation_items(key), -- Pour sub-items (nullable)
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    is_system_item BOOLEAN DEFAULT false, -- Items système (non supprimables)
    
    -- Métadonnées
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_navigation_items_key ON navigation_items(key);
CREATE INDEX idx_navigation_items_parent ON navigation_items(parent_key);
CREATE INDEX idx_navigation_items_active ON navigation_items(is_active) WHERE is_active = true;
```

### 2. Table `profile_navigation_items`

Table de liaison entre profils et éléments de navigation. Permet d'activer/désactiver des items par profil.

```sql
CREATE TABLE profile_navigation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    navigation_item_key TEXT NOT NULL REFERENCES navigation_items(key) ON DELETE CASCADE,
    
    -- Configuration
    is_enabled BOOLEAN DEFAULT true, -- Activer/désactiver pour ce profil
    is_visible BOOLEAN DEFAULT true, -- Visible dans la sidebar
    custom_sort_order INTEGER, -- Ordre personnalisé pour ce profil (override global)
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte unique
    UNIQUE(profile_id, navigation_item_key)
);

CREATE INDEX idx_profile_nav_profile ON profile_navigation_items(profile_id);
CREATE INDEX idx_profile_nav_item ON profile_navigation_items(navigation_item_key);
CREATE INDEX idx_profile_nav_enabled ON profile_navigation_items(profile_id, is_enabled) WHERE is_enabled = true;
```

### 3. Table `organization_navigation_items` (Optionnel - Multi-tenant)

Pour personnaliser la navigation par organisation.

```sql
CREATE TABLE organization_navigation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    navigation_item_key TEXT NOT NULL REFERENCES navigation_items(key) ON DELETE CASCADE,
    
    -- Configuration
    is_enabled BOOLEAN DEFAULT true,
    is_visible BOOLEAN DEFAULT true,
    custom_name TEXT, -- Nom personnalisé pour cette organisation
    custom_icon TEXT, -- Icône personnalisée
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte unique
    UNIQUE(organization_id, navigation_item_key)
);

CREATE INDEX idx_org_nav_org ON organization_navigation_items(organization_id);
CREATE INDEX idx_org_nav_item ON organization_navigation_items(navigation_item_key);
```

## Logique de Vérification d'Accès

### Ordre de Priorité

1. **Plan Feature Security** : Vérifier si la feature est activée dans le plan
2. **Profile Permission Security** : Vérifier si l'utilisateur a la permission dans son profil
3. **Profile Navigation Override** : Vérifier si l'item est activé pour le profil
4. **Organization Navigation Override** : Vérifier si l'item est activé pour l'organisation

### Pseudo-code

```typescript
function canAccessNavigationItem(
  item: NavigationItem,
  userPlan: Plan,
  userProfile: Profile,
  userOrganization: Organization
): boolean {
  // 1. Check Plan Feature Security
  if (item.required_feature_key) {
    const featureEnabled = isFeatureEnabledInPlan(userPlan, item.required_feature_key);
    if (!featureEnabled) return false;
  }
  
  // 2. Check Profile Permission Security
  if (item.required_permission || item.required_object_type) {
    const hasPermission = checkProfilePermission(
      userProfile,
      item.required_permission,
      item.required_object_type,
      item.required_object_action
    );
    if (!hasPermission) return false;
  }
  
  // 3. Check Profile Navigation Override
  const profileNavItem = getProfileNavigationItem(userProfile.id, item.key);
  if (profileNavItem && !profileNavItem.is_enabled) return false;
  
  // 4. Check Organization Navigation Override
  const orgNavItem = getOrganizationNavigationItem(userOrganization.id, item.key);
  if (orgNavItem && !orgNavItem.is_enabled) return false;
  
  // 5. Check if item is active
  if (!item.is_active) return false;
  
  return true;
}
```

## Avantages

### ✅ Flexibilité
- Ajouter/modifier/supprimer des items sans déploiement
- Personnalisation par profil et par organisation
- Configuration via interface admin

### ✅ Scalabilité
- Support multi-tenant
- Gestion centralisée
- Performance optimisée avec index

### ✅ Sécurité
- Double vérification (Plan + Profile)
- Override par profil/organisation
- Audit trail avec timestamps

### ✅ Maintenabilité
- Code plus simple (pas de configuration statique)
- Tests plus faciles
- Documentation automatique via schéma

## Migration depuis Configuration Statique

### Étape 1: Créer les tables
```sql
-- Exécuter le script de création des tables
```

### Étape 2: Migrer les données
```sql
-- Insérer les items existants depuis sidebar.tsx
INSERT INTO navigation_items (key, name, href, icon, required_feature_key, required_permission, sort_order)
VALUES
  ('dashboard', 'Dashboard', '/dashboard', 'LayoutDashboard', NULL, 'canViewAllProperties', 1),
  ('properties', 'Biens', '/properties', 'Building2', 'property_management', 'canViewAllProperties', 2),
  ('units', 'Lots', '/units', 'Home', 'property_management', 'canViewAllUnits', 3),
  -- ... etc
```

### Étape 3: Créer les associations par défaut
```sql
-- Activer tous les items pour tous les profils par défaut
INSERT INTO profile_navigation_items (profile_id, navigation_item_key, is_enabled)
SELECT p.id, ni.key, true
FROM profiles p
CROSS JOIN navigation_items ni
WHERE ni.is_active = true;
```

### Étape 4: Mettre à jour le code
- Remplacer `navigationItems` statique par requête DB
- Utiliser `canAccessNavigationItem()` pour vérifier l'accès
- Créer interface admin pour gérer les items

## Exemple d'Utilisation

### API Route: `/api/navigation/items`
```typescript
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user.id);
  const organization = await getUserOrganization(user.id);
  const plan = await getOrganizationPlan(organization.id);
  
  // Récupérer tous les items actifs
  const allItems = await db.select('navigation_items', {
    eq: { is_active: true },
    orderBy: { column: 'sort_order', ascending: true }
  });
  
  // Filtrer par accès
  const accessibleItems = allItems.filter(item => 
    canAccessNavigationItem(item, plan, profile, organization)
  );
  
  // Appliquer les overrides de profil et organisation
  const finalItems = await applyNavigationOverrides(
    accessibleItems,
    profile.id,
    organization.id
  );
  
  return NextResponse.json({ items: finalItems });
}
```

## Interface Admin

Créer une page `/admin/navigation-items` pour :
- ✅ Gérer les items de navigation
- ✅ Configurer les permissions par profil
- ✅ Personnaliser par organisation
- ✅ Prévisualiser la navigation

## Conclusion

Cette approche offre une **flexibilité maximale** tout en maintenant la **sécurité à deux niveaux** (Plan + Profile). Elle permet une **gestion dynamique** sans compromettre la sécurité.

