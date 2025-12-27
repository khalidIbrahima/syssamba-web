-- =====================================================
-- Table pour les rôles personnalisés par organisation
-- =====================================================

CREATE TABLE IF NOT EXISTS custom_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- Nom du rôle (ex: "Gestionnaire Senior")
    slug TEXT NOT NULL, -- Identifiant unique (ex: "senior_manager")
    description TEXT,
    color TEXT DEFAULT 'bg-gray-100 text-gray-800', -- Couleur du badge
    permissions JSONB NOT NULL DEFAULT '{}', -- Permissions stockées en JSONB
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte d'unicité : un slug unique par organisation
    UNIQUE(organization_id, slug)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_custom_roles_organization ON custom_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_slug ON custom_roles(organization_id, slug);

-- Ajouter la table à la publication Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE custom_roles;

-- Commentaires
COMMENT ON TABLE custom_roles IS 'Rôles personnalisés créés par les organisations';
COMMENT ON COLUMN custom_roles.permissions IS 'Permissions stockées en JSONB, format: {"canViewAllTasks": true, "canCreateProperties": false, ...}';
COMMENT ON COLUMN custom_roles.slug IS 'Identifiant unique du rôle au sein de l''organisation (ex: "senior_manager", "assistant")';

