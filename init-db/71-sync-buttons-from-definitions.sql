-- =================================================================
-- SAMBA ONE - Sync Buttons from Code Definitions
-- This script ensures all buttons from button-definitions.ts exist in the database
-- =================================================================

-- Function to ensure a button exists in the database
CREATE OR REPLACE FUNCTION ensure_button_exists(
    p_key TEXT,
    p_name TEXT,
    p_label TEXT,
    p_object_type TEXT,
    p_action TEXT,
    p_icon TEXT DEFAULT NULL,
    p_variant TEXT DEFAULT 'default',
    p_size TEXT DEFAULT 'default',
    p_tooltip TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_button_id UUID;
BEGIN
    -- Check if button exists
    SELECT id INTO v_button_id
    FROM buttons
    WHERE key = p_key;

    IF v_button_id IS NULL THEN
        -- Create button
        INSERT INTO buttons (
            key, name, label, button_type, variant, size,
            object_type, action, icon, tooltip, description,
            is_active, is_system_button, sort_order
        ) VALUES (
            p_key, p_name, p_label, 'button', p_variant, p_size,
            p_object_type, p_action, p_icon, p_tooltip, p_description,
            TRUE, TRUE, 0
        ) RETURNING id INTO v_button_id;
        
        RAISE NOTICE 'Created button: % (%)', p_key, p_name;
    ELSE
        -- Update button if it exists (to sync with code definitions)
        UPDATE buttons
        SET
            name = p_name,
            label = p_label,
            object_type = p_object_type,
            action = p_action,
            icon = p_icon,
            variant = p_variant,
            size = p_size,
            tooltip = p_tooltip,
            description = p_description,
            updated_at = NOW()
        WHERE id = v_button_id;
        
        RAISE NOTICE 'Updated button: % (%)', p_key, p_name;
    END IF;

    RETURN v_button_id;
END;
$$ LANGUAGE plpgsql;

-- Insert/Update all buttons from code definitions
-- Property buttons
SELECT ensure_button_exists('property.create', 'Créer un bien', 'Créer un bien', 'Property', 'create', 'Plus', 'default', 'default', NULL, NULL);
SELECT ensure_button_exists('property.edit', 'Modifier un bien', 'Modifier', 'Property', 'edit', 'Edit', 'outline', 'sm', NULL, NULL);
SELECT ensure_button_exists('property.delete', 'Supprimer un bien', 'Supprimer', 'Property', 'delete', 'Trash2', 'destructive', 'sm', NULL, NULL);
SELECT ensure_button_exists('property.view', 'Voir un bien', 'Voir', 'Property', 'view', 'Eye', 'ghost', 'sm', NULL, NULL);

-- Tenant buttons
SELECT ensure_button_exists('tenant.create', 'Créer un locataire', 'Créer un locataire', 'Tenant', 'create', 'UserPlus', 'default', 'default', NULL, NULL);
SELECT ensure_button_exists('tenant.edit', 'Modifier un locataire', 'Modifier', 'Tenant', 'edit', 'Edit', 'outline', 'sm', NULL, NULL);
SELECT ensure_button_exists('tenant.delete', 'Supprimer un locataire', 'Supprimer', 'Tenant', 'delete', 'Trash2', 'destructive', 'sm', NULL, NULL);

-- Lease buttons
SELECT ensure_button_exists('lease.create', 'Créer un bail', 'Créer un bail', 'Lease', 'create', 'FileText', 'default', 'default', NULL, NULL);
SELECT ensure_button_exists('lease.edit', 'Modifier un bail', 'Modifier', 'Lease', 'edit', 'Edit', 'outline', 'sm', NULL, NULL);
SELECT ensure_button_exists('lease.delete', 'Supprimer un bail', 'Supprimer', 'Lease', 'delete', 'Trash2', 'destructive', 'sm', NULL, NULL);

-- Payment buttons
SELECT ensure_button_exists('payment.create', 'Enregistrer un paiement', 'Enregistrer un paiement', 'Payment', 'create', 'CreditCard', 'default', 'default', NULL, NULL);
SELECT ensure_button_exists('payment.edit', 'Modifier un paiement', 'Modifier', 'Payment', 'edit', 'Edit', 'outline', 'sm', NULL, NULL);
SELECT ensure_button_exists('payment.delete', 'Supprimer un paiement', 'Supprimer', 'Payment', 'delete', 'Trash2', 'destructive', 'sm', NULL, NULL);
SELECT ensure_button_exists('payment.export', 'Exporter les paiements', 'Exporter', 'Payment', 'export', 'Download', 'outline', 'sm', NULL, NULL);

-- Journal Entry buttons
SELECT ensure_button_exists('journal.create', 'Créer une écriture', 'Nouvelle Écriture', 'JournalEntry', 'create', 'Plus', 'default', 'default', NULL, NULL);
SELECT ensure_button_exists('journal.edit', 'Modifier une écriture', 'Modifier', 'JournalEntry', 'edit', 'Edit', 'outline', 'sm', NULL, NULL);
SELECT ensure_button_exists('journal.delete', 'Supprimer une écriture', 'Supprimer', 'JournalEntry', 'delete', 'Trash2', 'destructive', 'sm', NULL, NULL);
SELECT ensure_button_exists('journal.validate', 'Valider une écriture', 'Valider', 'JournalEntry', 'custom', 'CheckCircle', 'default', 'sm', NULL, NULL);

-- Task buttons
SELECT ensure_button_exists('task.create', 'Créer une tâche', 'Créer une tâche', 'Task', 'create', 'Plus', 'default', 'default', NULL, NULL);
SELECT ensure_button_exists('task.edit', 'Modifier une tâche', 'Modifier', 'Task', 'edit', 'Edit', 'outline', 'sm', NULL, NULL);
SELECT ensure_button_exists('task.delete', 'Supprimer une tâche', 'Supprimer', 'Task', 'delete', 'Trash2', 'destructive', 'sm', NULL, NULL);

-- User buttons
SELECT ensure_button_exists('user.create', 'Inviter un utilisateur', 'Inviter utilisateur', 'User', 'create', 'UserPlus', 'default', 'default', NULL, NULL);
SELECT ensure_button_exists('user.edit', 'Modifier un utilisateur', 'Modifier', 'User', 'edit', 'Edit', 'outline', 'sm', NULL, NULL);
SELECT ensure_button_exists('user.delete', 'Supprimer un utilisateur', 'Supprimer', 'User', 'delete', 'Trash2', 'destructive', 'sm', NULL, NULL);

-- Clean up function
DROP FUNCTION IF EXISTS ensure_button_exists(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

DO $$
BEGIN
    RAISE NOTICE 'Buttons synced from code definitions successfully!';
END $$;

