-- =====================================================
-- 19-create-activities-table.sql
-- Créer une table générique pour tracker les activités sur toutes les entités
-- =====================================================

-- Table générique pour les activités
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    entity_type TEXT NOT NULL, -- 'property', 'unit', 'tenant', 'lease', 'payment', 'journal_entry', 'task', 'user', etc.
    entity_id UUID NOT NULL, -- ID de l'entité concernée
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Utilisateur qui a effectué l'action
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed', 'assigned', etc.
    field_name TEXT, -- Nom du champ modifié (si applicable)
    old_value TEXT, -- Ancienne valeur (si applicable)
    new_value TEXT, -- Nouvelle valeur (si applicable)
    description TEXT NOT NULL, -- Description lisible de l'action
    metadata JSONB, -- Métadonnées supplémentaires (anciennes valeurs complètes, nouvelles valeurs complètes, etc.)
    ip_address TEXT, -- Adresse IP de l'utilisateur (optionnel)
    user_agent TEXT, -- User agent du navigateur (optionnel)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_action ON activities(action);

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_activities_org_entity ON activities(organization_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_created ON activities(organization_id, created_at DESC);

-- Commentaires
COMMENT ON TABLE activities IS 'Historique générique des activités sur toutes les entités du système';
COMMENT ON COLUMN activities.entity_type IS 'Type d''entité: property, unit, tenant, lease, payment, journal_entry, task, user, etc.';
COMMENT ON COLUMN activities.entity_id IS 'ID de l''entité concernée';
COMMENT ON COLUMN activities.action IS 'Type d''action: created, updated, deleted, status_changed, assigned, etc.';
COMMENT ON COLUMN activities.field_name IS 'Nom du champ modifié (pour les actions de type updated)';
COMMENT ON COLUMN activities.old_value IS 'Ancienne valeur du champ (pour les actions de type updated)';
COMMENT ON COLUMN activities.new_value IS 'Nouvelle valeur du champ (pour les actions de type updated)';
COMMENT ON COLUMN activities.description IS 'Description lisible de l''action pour l''affichage';
COMMENT ON COLUMN activities.metadata IS 'Métadonnées supplémentaires au format JSON (anciennes/nouvelles valeurs complètes, etc.)';

DO $$
BEGIN
    RAISE NOTICE '✓ Table activities créée avec succès';
END $$;

