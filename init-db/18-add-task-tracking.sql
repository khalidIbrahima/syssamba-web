-- =====================================================
-- 18-add-task-tracking.sql
-- Ajouter le suivi des activités et créateur pour les tâches
-- =====================================================

-- Ajouter la colonne created_by si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE tasks 
        ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
        
        RAISE NOTICE '✓ Colonne created_by ajoutée à tasks';
    ELSE
        RAISE NOTICE '✓ Colonne created_by existe déjà';
    END IF;
END $$;

-- Créer la table task_activities pour tracker les activités
CREATE TABLE IF NOT EXISTS task_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'status_changed', 'assigned', 'commented', 'attachment_added', etc.
    field_name TEXT, -- Nom du champ modifié (si applicable)
    old_value TEXT, -- Ancienne valeur (si applicable)
    new_value TEXT, -- Nouvelle valeur (si applicable)
    description TEXT, -- Description de l'action
    metadata JSONB, -- Métadonnées supplémentaires
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_task_activities_task ON task_activities(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activities_user ON task_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activities_created ON task_activities(created_at);

-- Commentaires
COMMENT ON TABLE task_activities IS 'Historique des activités sur les tâches';
COMMENT ON COLUMN task_activities.action IS 'Type d''action: created, updated, status_changed, assigned, commented, etc.';
COMMENT ON COLUMN task_activities.field_name IS 'Nom du champ modifié (pour les actions de type updated)';
COMMENT ON COLUMN task_activities.old_value IS 'Ancienne valeur du champ (pour les actions de type updated)';
COMMENT ON COLUMN task_activities.new_value IS 'Nouvelle valeur du champ (pour les actions de type updated)';
COMMENT ON COLUMN task_activities.metadata IS 'Métadonnées supplémentaires au format JSON';

