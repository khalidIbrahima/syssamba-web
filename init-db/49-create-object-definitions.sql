-- =====================================================
-- Object Definitions Table
-- Permet aux super-admins d'ajouter dynamiquement de nouveaux types d'objets
-- =====================================================

CREATE TABLE IF NOT EXISTS object_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identifiant unique de l'objet (ex: 'Contract', 'Invoice', 'Document')
    object_key TEXT UNIQUE NOT NULL,
    
    -- Nom d'affichage (ex: 'Contrat', 'Facture', 'Document')
    display_name TEXT NOT NULL,
    
    -- Description de l'objet
    description TEXT,
    
    -- Table de base de données associée (optionnel, pour RLS)
    database_table TEXT,
    
    -- Champ de propriétaire pour RLS (ex: 'created_by', 'owner_id')
    ownership_field TEXT,
    
    -- Champs sensibles pour FLS (stockés en JSONB)
    sensitive_fields JSONB DEFAULT '[]'::jsonb,
    
    -- Métadonnées
    icon TEXT, -- Nom de l'icône (ex: 'FileText', 'Contract')
    category TEXT, -- Catégorie (ex: 'core', 'accounting', 'custom')
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE, -- Les objets système ne peuvent pas être supprimés
    
    -- Ordre d'affichage
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_object_definitions_key ON object_definitions(object_key);
CREATE INDEX IF NOT EXISTS idx_object_definitions_active ON object_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_object_definitions_category ON object_definitions(category);

-- Commentaires
COMMENT ON TABLE object_definitions IS 'Définitions d''objets dynamiques - Permet aux super-admins d''ajouter de nouveaux types d''objets';
COMMENT ON COLUMN object_definitions.object_key IS 'Clé unique de l''objet (utilisée dans le code, ex: Contract)';
COMMENT ON COLUMN object_definitions.display_name IS 'Nom d''affichage (ex: Contrat)';
COMMENT ON COLUMN object_definitions.database_table IS 'Table de base de données associée (pour RLS)';
COMMENT ON COLUMN object_definitions.ownership_field IS 'Champ de propriétaire pour Record-Level Security';
COMMENT ON COLUMN object_definitions.sensitive_fields IS 'Liste des champs sensibles (JSONB array)';
COMMENT ON COLUMN object_definitions.is_system IS 'Les objets système ne peuvent pas être supprimés';

-- Ajouter les objets système existants
INSERT INTO object_definitions (object_key, display_name, description, database_table, ownership_field, sensitive_fields, is_system, category, sort_order)
VALUES
    ('Property', 'Propriété', 'Gestion des biens immobiliers', 'properties', 'created_by', '["purchasePrice", "purchaseDate", "mortgageDetails"]'::jsonb, TRUE, 'core', 1),
    ('Unit', 'Lot', 'Gestion des lots/unités locatives', 'units', 'created_by', '["rentAmount", "chargesAmount", "depositAmount"]'::jsonb, TRUE, 'core', 2),
    ('Tenant', 'Locataire', 'Gestion des locataires', 'tenants', 'created_by', '["email", "phone", "idNumber", "bankDetails"]'::jsonb, TRUE, 'core', 3),
    ('Lease', 'Bail', 'Gestion des baux', 'leases', 'created_by', '["rentAmount", "depositAmount", "terms"]'::jsonb, TRUE, 'core', 4),
    ('Payment', 'Paiement', 'Gestion des paiements', 'payments', 'created_by', '["amount", "paymentMethod", "transactionId", "bankDetails"]'::jsonb, TRUE, 'core', 5),
    ('Task', 'Tâche', 'Gestion des tâches', 'tasks', 'assigned_to', '["assignedTo", "dueDate", "priority"]'::jsonb, TRUE, 'core', 6),
    ('Message', 'Message', 'Messages entre locataires et agence', 'messages', 'sender_id', '["content", "attachments"]'::jsonb, TRUE, 'core', 7),
    ('JournalEntry', 'Écriture comptable', 'Écritures comptables SYSCOHADA', 'journal_entries', 'created_by', '["amount", "account", "description"]'::jsonb, TRUE, 'accounting', 8),
    ('User', 'Utilisateur', 'Gestion des utilisateurs', 'users', NULL, '["email", "phone", "role", "salary"]'::jsonb, TRUE, 'core', 9),
    ('Organization', 'Organisation', 'Paramètres de l''organisation', 'organizations', NULL, '["stripeCustomerId", "billingEmail", "plan"]'::jsonb, TRUE, 'core', 10),
    ('Report', 'Rapport', 'Rapports et analyses', NULL, 'created_by', '["data", "filters"]'::jsonb, TRUE, 'core', 11),
    ('Activity', 'Activité', 'Journal des activités', NULL, 'user_id', '["details", "metadata"]'::jsonb, TRUE, 'core', 12)
ON CONFLICT (object_key) DO NOTHING;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_object_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_object_definitions_updated_at
    BEFORE UPDATE ON object_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_object_definitions_updated_at();

-- Ajouter à la publication Supabase Realtime (si utilisée)
-- ALTER PUBLICATION supabase_realtime ADD TABLE object_definitions;


