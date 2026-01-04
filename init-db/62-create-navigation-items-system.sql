-- =================================================================
-- SAMBA ONE - Navigation Items System
-- Tables pour gérer dynamiquement les éléments de navigation
-- =================================================================

-- Table: navigation_items
-- Définit tous les éléments de navigation disponibles dans l'application
CREATE TABLE IF NOT EXISTS navigation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification unique
    key TEXT NOT NULL UNIQUE, -- e.g., 'dashboard', 'properties', 'tasks'
    name TEXT NOT NULL, -- Nom d'affichage (e.g., 'Dashboard', 'Biens')
    href TEXT NOT NULL, -- Route (e.g., '/dashboard', '/properties')
    
    -- Métadonnées UI
    icon TEXT, -- Nom de l'icône Lucide (e.g., 'LayoutDashboard', 'Building2')
    badge_count INTEGER DEFAULT NULL, -- Nombre pour badge (null = pas de badge, 0 = badge vide)
    sort_order INTEGER DEFAULT 0, -- Ordre d'affichage dans la sidebar
    
    -- Sécurité Plan (Feature Level)
    required_feature_key TEXT REFERENCES features(name) ON DELETE SET NULL, -- Feature requise du plan (nullable)
    
    -- Sécurité Profile (Permission Level)
    required_permission TEXT, -- Permission requise (e.g., 'canViewAllProperties')
    required_object_type TEXT, -- Object type pour permission (e.g., 'Property')
    required_object_action TEXT DEFAULT 'read' CHECK (required_object_action IN ('read', 'create', 'edit', 'delete')),
    
    -- Hiérarchie (pour sub-items)
    parent_key TEXT REFERENCES navigation_items(key) ON DELETE CASCADE, -- Pour sub-items (nullable)
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    is_system_item BOOLEAN DEFAULT false, -- Items système (non supprimables par admin)
    
    -- Métadonnées
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_navigation_items_key ON navigation_items(key);
CREATE INDEX IF NOT EXISTS idx_navigation_items_parent ON navigation_items(parent_key);
CREATE INDEX IF NOT EXISTS idx_navigation_items_active ON navigation_items(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_navigation_items_feature ON navigation_items(required_feature_key) WHERE required_feature_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_navigation_items_sort ON navigation_items(sort_order);

-- Table: profile_navigation_items
-- Table de liaison entre profils et éléments de navigation (JUNCTION TABLE)
-- Permet d'activer/désactiver des items par profil
-- PRIMARY KEY composite: (profile_id, navigation_item_id)
CREATE TABLE IF NOT EXISTS profile_navigation_items (
    -- Relations (composite primary key)
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    navigation_item_id UUID NOT NULL REFERENCES navigation_items(id) ON DELETE CASCADE,
    
    -- Configuration
    is_enabled BOOLEAN DEFAULT true, -- Activer/désactiver pour ce profil
    is_visible BOOLEAN DEFAULT true, -- Visible dans la sidebar
    custom_sort_order INTEGER, -- Ordre personnalisé pour ce profil (override global)
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- PRIMARY KEY composite: (profile_id, navigation_item_id)
    PRIMARY KEY (profile_id, navigation_item_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profile_nav_profile ON profile_navigation_items(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_nav_item ON profile_navigation_items(navigation_item_id);
CREATE INDEX IF NOT EXISTS idx_profile_nav_enabled ON profile_navigation_items(profile_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_profile_nav_visible ON profile_navigation_items(profile_id, is_visible) WHERE is_visible = true;

-- Table: organization_navigation_items (Optionnel - Multi-tenant)
-- Pour personnaliser la navigation par organisation
CREATE TABLE IF NOT EXISTS organization_navigation_items (
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
    
    -- Contrainte unique: une organisation ne peut avoir qu'une seule configuration par item
    UNIQUE(organization_id, navigation_item_key)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_org_nav_org ON organization_navigation_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_nav_item ON organization_navigation_items(navigation_item_key);
CREATE INDEX IF NOT EXISTS idx_org_nav_enabled ON organization_navigation_items(organization_id, is_enabled) WHERE is_enabled = true;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_navigation_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_navigation_items_updated_at
    BEFORE UPDATE ON navigation_items
    FOR EACH ROW
    EXECUTE FUNCTION update_navigation_items_updated_at();

CREATE TRIGGER trigger_profile_nav_items_updated_at
    BEFORE UPDATE ON profile_navigation_items
    FOR EACH ROW
    EXECUTE FUNCTION update_navigation_items_updated_at();

CREATE TRIGGER trigger_org_nav_items_updated_at
    BEFORE UPDATE ON organization_navigation_items
    FOR EACH ROW
    EXECUTE FUNCTION update_navigation_items_updated_at();

-- Insertion des items de navigation par défaut
-- Migration depuis la configuration statique actuelle
INSERT INTO navigation_items (key, name, href, icon, badge_count, sort_order, required_feature_key, required_permission, required_object_type, required_object_action, is_system_item, description)
VALUES
    -- Dashboard (toujours visible)
    ('dashboard', 'Dashboard', '/dashboard', 'LayoutDashboard', NULL, 1, NULL, 'canViewAllProperties', 'Property', 'read', true, 'Tableau de bord principal'),
    
    -- Property Management
    ('properties', 'Biens', '/properties', 'Building2', NULL, 2, 'property_management', 'canViewAllProperties', 'Property', 'read', true, 'Gestion des biens immobiliers'),
    ('units', 'Lots', '/units', 'Home', NULL, 3, 'property_management', 'canViewAllUnits', 'Unit', 'read', true, 'Gestion des lots/unités locatives'),
    ('owners', 'Propriétaires', '/owners', 'UserCircle', NULL, 4, 'property_management', 'canViewAllProperties', 'Property', 'read', true, 'Gestion des propriétaires'),
    
    -- Tenant Management
    ('tenants', 'Locataires', '/tenants', 'Users', NULL, 5, 'tenant_management', 'canViewAllTenants', 'Tenant', 'read', true, 'Gestion des locataires'),
    
    -- Lease Management
    ('leases', 'Baux', '/leases', 'FileText', NULL, 6, 'lease_management', 'canViewAllLeases', 'Lease', 'read', true, 'Gestion des baux'),
    
    -- Payment Management
    ('payments', 'Paiements', '/payments', 'CreditCard', 5, 7, 'rent_collection', 'canViewAllPayments', 'Payment', 'read', true, 'Gestion des paiements'),
    
    -- Accounting
    ('accounting', 'Comptabilité', '/accounting', 'Calculator', NULL, 8, 'accounting', 'canViewAccounting', 'JournalEntry', 'read', true, 'Journal comptable SYSCOHADA'),
    
    -- Task Management
    ('tasks', 'Tâches', '/tasks', 'CheckSquare', 12, 9, 'task_management', 'canViewAllTasks', 'Task', 'read', true, 'Gestion des tâches'),
    
    -- Messaging
    ('notifications', 'Messages', '/notifications', 'MessageSquare', NULL, 10, 'messaging', 'canSendMessages', 'Message', 'read', true, 'Centre de messagerie'),
    
    -- Settings
    ('settings', 'Paramètres', '/settings', 'Settings', NULL, 11, NULL, 'canViewSettings', 'Organization', 'read', true, 'Paramètres de l''organisation')
ON CONFLICT (key) DO NOTHING;

-- Insertion des sub-items pour Payments
INSERT INTO navigation_items (key, name, href, icon, badge_count, sort_order, required_feature_key, required_permission, required_object_type, required_object_action, parent_key, is_system_item, description)
VALUES
    ('payments-tenant', 'Paiements locataires', '/payments?tab=tenant-payments', NULL, NULL, 1, 'rent_collection', 'canViewAllPayments', 'Payment', 'read', 'payments', true, 'Paiements des locataires'),
    ('payments-owner', 'Virements propriétaires', '/payments?tab=owner-transfers', NULL, NULL, 2, 'rent_collection', 'canViewAllPayments', 'Payment', 'read', 'payments', true, 'Virements aux propriétaires')
ON CONFLICT (key) DO NOTHING;

-- Activer tous les items pour tous les profils par défaut
-- Cela permet à tous les profils de voir tous les items (sous réserve des permissions)
INSERT INTO profile_navigation_items (profile_id, navigation_item_id, is_enabled, is_visible)
SELECT p.id, ni.id, true, true
FROM profiles p
CROSS JOIN navigation_items ni
WHERE ni.is_active = true
ON CONFLICT (profile_id, navigation_item_id) DO NOTHING;

-- Commentaires pour documentation
COMMENT ON TABLE navigation_items IS 'Définit tous les éléments de navigation disponibles dans l''application';
COMMENT ON TABLE profile_navigation_items IS 'Liaison entre profils et éléments de navigation - permet de personnaliser la navigation par profil';
COMMENT ON TABLE organization_navigation_items IS 'Liaison entre organisations et éléments de navigation - permet de personnaliser la navigation par organisation (multi-tenant)';

COMMENT ON COLUMN navigation_items.key IS 'Clé unique de l''item (e.g., ''dashboard'', ''properties'')';
COMMENT ON COLUMN navigation_items.required_feature_key IS 'Feature du plan requise pour accéder à cet item (Plan Security Level)';
COMMENT ON COLUMN navigation_items.required_permission IS 'Permission du profil requise pour accéder à cet item (Profile Security Level)';
COMMENT ON COLUMN navigation_items.parent_key IS 'Clé de l''item parent pour créer une hiérarchie (sub-items)';
COMMENT ON COLUMN navigation_items.is_system_item IS 'Items système ne peuvent pas être supprimés par les admins';

