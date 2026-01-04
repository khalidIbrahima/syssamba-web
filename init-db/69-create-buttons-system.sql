-- =================================================================
-- SAMBA ONE - Buttons System
-- Tables pour gérer dynamiquement les boutons et leurs permissions par profil
-- =================================================================

-- Table: buttons
-- Définit tous les boutons disponibles dans l'application
CREATE TABLE IF NOT EXISTS buttons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification unique
    key TEXT NOT NULL UNIQUE, -- e.g., 'property.create', 'tenant.edit', 'payment.delete'
    name TEXT NOT NULL, -- Nom d'affichage (e.g., 'Créer un bien', 'Modifier locataire')
    label TEXT NOT NULL, -- Label du bouton (e.g., 'Créer', 'Modifier', 'Supprimer')
    
    -- Type de bouton
    button_type TEXT NOT NULL DEFAULT 'button' CHECK (button_type IN ('button', 'icon', 'link', 'menu_item')),
    variant TEXT DEFAULT 'default' CHECK (variant IN ('default', 'destructive', 'outline', 'secondary', 'ghost', 'link')),
    size TEXT DEFAULT 'default' CHECK (size IN ('default', 'sm', 'lg', 'icon')),
    
    -- Relation avec objet
    object_type TEXT NOT NULL, -- Type d'objet (e.g., 'Property', 'Tenant', 'Payment', 'Lease')
    action TEXT NOT NULL DEFAULT 'create' CHECK (action IN ('create', 'read', 'update', 'edit', 'delete', 'view', 'export', 'import', 'print', 'custom')),
    
    -- Métadonnées UI
    icon TEXT, -- Nom de l'icône Lucide (e.g., 'Plus', 'Edit', 'Trash2')
    tooltip TEXT, -- Tooltip au survol
    sort_order INTEGER DEFAULT 0, -- Ordre d'affichage
    
    -- Sécurité Plan (Feature Level)
    feature_id UUID REFERENCES features(id) ON DELETE SET NULL, -- Feature requise du plan
    
    -- Sécurité Profile (Permission Level)
    required_permission TEXT, -- Permission requise (e.g., 'canCreateProperties')
    required_object_type TEXT, -- Object type pour permission (e.g., 'Property')
    required_object_action TEXT DEFAULT 'create' CHECK (required_object_action IN ('read', 'create', 'edit', 'delete')),
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    is_system_button BOOLEAN DEFAULT false, -- Boutons système (non supprimables par admin)
    
    -- Métadonnées
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_buttons_key ON buttons(key);
CREATE INDEX IF NOT EXISTS idx_buttons_object_type ON buttons(object_type);
CREATE INDEX IF NOT EXISTS idx_buttons_action ON buttons(action);
CREATE INDEX IF NOT EXISTS idx_buttons_active ON buttons(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_buttons_feature ON buttons(feature_id) WHERE feature_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buttons_object_action ON buttons(object_type, action);

-- Table: profile_buttons
-- Table de liaison entre profils et boutons (JUNCTION TABLE)
-- Permet d'activer/désactiver des boutons par profil
-- PRIMARY KEY composite: (profile_id, button_id)
CREATE TABLE IF NOT EXISTS profile_buttons (
    -- Relations (composite primary key)
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    button_id UUID NOT NULL REFERENCES buttons(id) ON DELETE CASCADE,
    
    -- Configuration
    is_enabled BOOLEAN DEFAULT true, -- Activer/désactiver pour ce profil
    is_visible BOOLEAN DEFAULT true, -- Visible dans l'interface
    custom_label TEXT, -- Label personnalisé pour ce profil (override global)
    custom_icon TEXT, -- Icône personnalisée pour ce profil
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- PRIMARY KEY composite: (profile_id, button_id)
    PRIMARY KEY (profile_id, button_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profile_buttons_profile ON profile_buttons(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_buttons_button ON profile_buttons(button_id);
CREATE INDEX IF NOT EXISTS idx_profile_buttons_enabled ON profile_buttons(profile_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_profile_buttons_visible ON profile_buttons(profile_id, is_visible) WHERE is_visible = true;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_buttons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_buttons_updated_at
    BEFORE UPDATE ON buttons
    FOR EACH ROW
    EXECUTE FUNCTION update_buttons_updated_at();

CREATE TRIGGER trigger_profile_buttons_updated_at
    BEFORE UPDATE ON profile_buttons
    FOR EACH ROW
    EXECUTE FUNCTION update_buttons_updated_at();

-- Insertion des boutons par défaut
-- Note: Les définitions de boutons sont maintenant dans le code (src/lib/button-definitions.ts)
-- Ce script crée les boutons de base dans la table pour la synchronisation avec profile_buttons
INSERT INTO buttons (key, name, label, button_type, variant, size, object_type, action, icon, tooltip, sort_order, required_object_type, required_object_action, is_system_button, description)
VALUES
    -- Property buttons
    ('property.create', 'Créer un bien', 'Créer un bien', 'button', 'default', 'default', 'Property', 'create', 'Plus', 'Créer un nouveau bien immobilier', 1, 'Property', 'create', true, 'Bouton pour créer un nouveau bien'),
    ('property.edit', 'Modifier un bien', 'Modifier', 'button', 'outline', 'sm', 'Property', 'edit', 'Edit', 'Modifier le bien', 2, 'Property', 'edit', true, 'Bouton pour modifier un bien'),
    ('property.delete', 'Supprimer un bien', 'Supprimer', 'button', 'destructive', 'sm', 'Property', 'delete', 'Trash2', 'Supprimer le bien', 3, 'Property', 'delete', true, 'Bouton pour supprimer un bien'),
    ('property.view', 'Voir un bien', 'Voir', 'button', 'ghost', 'sm', 'Property', 'view', 'Eye', 'Voir les détails', 4, 'Property', 'read', true, 'Bouton pour voir les détails'),
    
    -- Tenant buttons
    ('tenant.create', 'Créer un locataire', 'Créer un locataire', 'button', 'default', 'default', 'Tenant', 'create', 'UserPlus', 'Créer un nouveau locataire', 1, 'Tenant', 'create', true, 'Bouton pour créer un nouveau locataire'),
    ('tenant.edit', 'Modifier un locataire', 'Modifier', 'button', 'outline', 'sm', 'Tenant', 'edit', 'Edit', 'Modifier le locataire', 2, 'Tenant', 'edit', true, 'Bouton pour modifier un locataire'),
    ('tenant.delete', 'Supprimer un locataire', 'Supprimer', 'button', 'destructive', 'sm', 'Tenant', 'delete', 'Trash2', 'Supprimer le locataire', 3, 'Tenant', 'delete', true, 'Bouton pour supprimer un locataire'),
    
    -- Lease buttons
    ('lease.create', 'Créer un bail', 'Créer un bail', 'button', 'default', 'default', 'Lease', 'create', 'FileText', 'Créer un nouveau bail', 1, 'Lease', 'create', true, 'Bouton pour créer un nouveau bail'),
    ('lease.edit', 'Modifier un bail', 'Modifier', 'button', 'outline', 'sm', 'Lease', 'edit', 'Edit', 'Modifier le bail', 2, 'Lease', 'edit', true, 'Bouton pour modifier un bail'),
    ('lease.delete', 'Supprimer un bail', 'Supprimer', 'button', 'destructive', 'sm', 'Lease', 'delete', 'Trash2', 'Supprimer le bail', 3, 'Lease', 'delete', true, 'Bouton pour supprimer un bail'),
    
    -- Payment buttons
    ('payment.create', 'Enregistrer un paiement', 'Enregistrer un paiement', 'button', 'default', 'default', 'Payment', 'create', 'CreditCard', 'Enregistrer un nouveau paiement', 1, 'Payment', 'create', true, 'Bouton pour enregistrer un paiement'),
    ('payment.edit', 'Modifier un paiement', 'Modifier', 'button', 'outline', 'sm', 'Payment', 'edit', 'Edit', 'Modifier le paiement', 2, 'Payment', 'edit', true, 'Bouton pour modifier un paiement'),
    ('payment.delete', 'Supprimer un paiement', 'Supprimer', 'button', 'destructive', 'sm', 'Payment', 'delete', 'Trash2', 'Supprimer le paiement', 3, 'Payment', 'delete', true, 'Bouton pour supprimer un paiement'),
    ('payment.export', 'Exporter les paiements', 'Exporter', 'button', 'outline', 'sm', 'Payment', 'export', 'Download', 'Exporter les paiements', 4, 'Payment', 'read', true, 'Bouton pour exporter les paiements'),
    
    -- Journal Entry buttons
    ('journal.create', 'Créer une écriture', 'Nouvelle Écriture', 'button', 'default', 'default', 'JournalEntry', 'create', 'Plus', 'Créer une nouvelle écriture comptable', 1, 'JournalEntry', 'create', true, 'Bouton pour créer une nouvelle écriture comptable'),
    ('journal.edit', 'Modifier une écriture', 'Modifier', 'button', 'outline', 'sm', 'JournalEntry', 'edit', 'Edit', 'Modifier l''écriture', 2, 'JournalEntry', 'edit', true, 'Bouton pour modifier une écriture'),
    ('journal.delete', 'Supprimer une écriture', 'Supprimer', 'button', 'destructive', 'sm', 'JournalEntry', 'delete', 'Trash2', 'Supprimer l''écriture', 3, 'JournalEntry', 'delete', true, 'Bouton pour supprimer une écriture'),
    ('journal.validate', 'Valider une écriture', 'Valider', 'button', 'default', 'sm', 'JournalEntry', 'custom', 'CheckCircle', 'Valider l''écriture', 4, 'JournalEntry', 'edit', true, 'Bouton pour valider une écriture comptable'),
    
    -- Task buttons
    ('task.create', 'Créer une tâche', 'Créer une tâche', 'button', 'default', 'default', 'Task', 'create', 'Plus', 'Créer une nouvelle tâche', 1, 'Task', 'create', true, 'Bouton pour créer une nouvelle tâche'),
    ('task.edit', 'Modifier une tâche', 'Modifier', 'button', 'outline', 'sm', 'Task', 'edit', 'Edit', 'Modifier la tâche', 2, 'Task', 'edit', true, 'Bouton pour modifier une tâche'),
    ('task.delete', 'Supprimer une tâche', 'Supprimer', 'button', 'destructive', 'sm', 'Task', 'delete', 'Trash2', 'Supprimer la tâche', 3, 'Task', 'delete', true, 'Bouton pour supprimer une tâche'),
    
    -- User buttons
    ('user.create', 'Inviter un utilisateur', 'Inviter utilisateur', 'button', 'default', 'default', 'User', 'create', 'UserPlus', 'Inviter un nouvel utilisateur', 1, 'User', 'create', true, 'Bouton pour inviter un nouvel utilisateur'),
    ('user.edit', 'Modifier un utilisateur', 'Modifier', 'button', 'outline', 'sm', 'User', 'edit', 'Edit', 'Modifier l''utilisateur', 2, 'User', 'edit', true, 'Bouton pour modifier un utilisateur'),
    ('user.delete', 'Supprimer un utilisateur', 'Supprimer', 'button', 'destructive', 'sm', 'User', 'delete', 'Trash2', 'Supprimer l''utilisateur', 3, 'User', 'delete', true, 'Bouton pour supprimer un utilisateur')
ON CONFLICT (key) DO NOTHING;

-- Activer tous les boutons pour tous les profils par défaut
-- Cela permet à tous les profils de voir tous les boutons (sous réserve des permissions)
INSERT INTO profile_buttons (profile_id, button_id, is_enabled, is_visible)
SELECT p.id, b.id, true, true
FROM profiles p
CROSS JOIN buttons b
WHERE b.is_active = true
ON CONFLICT (profile_id, button_id) DO NOTHING;

-- Commentaires pour documentation
COMMENT ON TABLE buttons IS 'Définit tous les boutons disponibles dans l''application';
COMMENT ON TABLE profile_buttons IS 'Liaison entre profils et boutons - permet de personnaliser l''accessibilité des boutons par profil';

COMMENT ON COLUMN buttons.key IS 'Clé unique du bouton (e.g., ''property.create'', ''tenant.edit'')';
COMMENT ON COLUMN buttons.object_type IS 'Type d''objet associé au bouton (e.g., ''Property'', ''Tenant'', ''Payment'')';
COMMENT ON COLUMN buttons.action IS 'Action du bouton (create, edit, delete, etc.)';
COMMENT ON COLUMN buttons.feature_id IS 'Feature du plan requise pour accéder à ce bouton (Plan Security Level)';
COMMENT ON COLUMN buttons.required_permission IS 'Permission du profil requise pour accéder à ce bouton (Profile Security Level)';
COMMENT ON COLUMN buttons.is_system_button IS 'Boutons système ne peuvent pas être supprimés par les admins';

