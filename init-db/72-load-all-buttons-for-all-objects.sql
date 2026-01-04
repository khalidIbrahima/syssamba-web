-- =================================================================
-- SAMBA ONE - Load All Buttons for All Objects
-- Script complet pour charger tous les boutons pour tous les objets du système
-- =================================================================

-- Function to insert or update a button
CREATE OR REPLACE FUNCTION upsert_button(
    p_key TEXT,
    p_name TEXT,
    p_label TEXT,
    p_object_type TEXT,
    p_action TEXT,
    p_icon TEXT DEFAULT NULL,
    p_variant TEXT DEFAULT 'default',
    p_size TEXT DEFAULT 'default',
    p_button_type TEXT DEFAULT 'button',
    p_tooltip TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_sort_order INTEGER DEFAULT 0,
    p_is_system_button BOOLEAN DEFAULT false,
    p_required_object_type TEXT DEFAULT NULL,
    p_required_object_action TEXT DEFAULT 'create'
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
            sort_order, is_active, is_system_button,
            required_object_type, required_object_action
        ) VALUES (
            p_key, p_name, p_label, p_button_type, p_variant, p_size,
            p_object_type, p_action, p_icon, p_tooltip, p_description,
            p_sort_order, TRUE, p_is_system_button,
            p_required_object_type, p_required_object_action
        ) RETURNING id INTO v_button_id;
        
        RAISE NOTICE 'Created button: % (%)', p_key, p_name;
    ELSE
        -- Update button if it exists
        UPDATE buttons
        SET
            name = p_name,
            label = p_label,
            button_type = p_button_type,
            variant = p_variant,
            size = p_size,
            object_type = p_object_type,
            action = p_action,
            icon = p_icon,
            tooltip = p_tooltip,
            description = p_description,
            sort_order = p_sort_order,
            required_object_type = COALESCE(p_required_object_type, required_object_type),
            required_object_action = p_required_object_action,
            updated_at = NOW()
        WHERE id = v_button_id;
        
        RAISE NOTICE 'Updated button: % (%)', p_key, p_name;
    END IF;

    RETURN v_button_id;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- PROPERTY BUTTONS
-- =================================================================
SELECT upsert_button('property.create', 'Créer un bien', 'Créer un bien', 'Property', 'create', 'Plus', 'default', 'default', 'button', 'Créer un nouveau bien immobilier', 'Bouton pour créer un nouveau bien', 1, true, 'Property', 'create');
SELECT upsert_button('property.edit', 'Modifier un bien', 'Modifier', 'Property', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier le bien', 'Bouton pour modifier un bien', 2, true, 'Property', 'edit');
SELECT upsert_button('property.delete', 'Supprimer un bien', 'Supprimer', 'Property', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer le bien', 'Bouton pour supprimer un bien', 3, true, 'Property', 'delete');
SELECT upsert_button('property.view', 'Voir un bien', 'Voir', 'Property', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'Property', 'read');
SELECT upsert_button('property.export', 'Exporter les biens', 'Exporter', 'Property', 'export', 'Download', 'outline', 'sm', 'button', 'Exporter les biens', 'Bouton pour exporter les biens', 5, true, 'Property', 'read');

-- =================================================================
-- UNIT BUTTONS
-- =================================================================
SELECT upsert_button('unit.create', 'Créer un lot', 'Créer un lot', 'Unit', 'create', 'Plus', 'default', 'default', 'button', 'Créer un nouveau lot', 'Bouton pour créer un nouveau lot', 1, true, 'Unit', 'create');
SELECT upsert_button('unit.edit', 'Modifier un lot', 'Modifier', 'Unit', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier le lot', 'Bouton pour modifier un lot', 2, true, 'Unit', 'edit');
SELECT upsert_button('unit.delete', 'Supprimer un lot', 'Supprimer', 'Unit', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer le lot', 'Bouton pour supprimer un lot', 3, true, 'Unit', 'delete');
SELECT upsert_button('unit.view', 'Voir un lot', 'Voir', 'Unit', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'Unit', 'read');

-- =================================================================
-- TENANT BUTTONS
-- =================================================================
SELECT upsert_button('tenant.create', 'Créer un locataire', 'Créer un locataire', 'Tenant', 'create', 'UserPlus', 'default', 'default', 'button', 'Créer un nouveau locataire', 'Bouton pour créer un nouveau locataire', 1, true, 'Tenant', 'create');
SELECT upsert_button('tenant.edit', 'Modifier un locataire', 'Modifier', 'Tenant', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier le locataire', 'Bouton pour modifier un locataire', 2, true, 'Tenant', 'edit');
SELECT upsert_button('tenant.delete', 'Supprimer un locataire', 'Supprimer', 'Tenant', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer le locataire', 'Bouton pour supprimer un locataire', 3, true, 'Tenant', 'delete');
SELECT upsert_button('tenant.view', 'Voir un locataire', 'Voir', 'Tenant', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'Tenant', 'read');
SELECT upsert_button('tenant.export', 'Exporter les locataires', 'Exporter', 'Tenant', 'export', 'Download', 'outline', 'sm', 'button', 'Exporter les locataires', 'Bouton pour exporter les locataires', 5, true, 'Tenant', 'read');

-- =================================================================
-- LEASE BUTTONS
-- =================================================================
SELECT upsert_button('lease.create', 'Créer un bail', 'Créer un bail', 'Lease', 'create', 'FileText', 'default', 'default', 'button', 'Créer un nouveau bail', 'Bouton pour créer un nouveau bail', 1, true, 'Lease', 'create');
SELECT upsert_button('lease.edit', 'Modifier un bail', 'Modifier', 'Lease', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier le bail', 'Bouton pour modifier un bail', 2, true, 'Lease', 'edit');
SELECT upsert_button('lease.delete', 'Supprimer un bail', 'Supprimer', 'Lease', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer le bail', 'Bouton pour supprimer un bail', 3, true, 'Lease', 'delete');
SELECT upsert_button('lease.view', 'Voir un bail', 'Voir', 'Lease', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'Lease', 'read');
SELECT upsert_button('lease.renew', 'Renouveler un bail', 'Renouveler', 'Lease', 'custom', 'RefreshCw', 'outline', 'sm', 'button', 'Renouveler le bail', 'Bouton pour renouveler un bail', 5, true, 'Lease', 'edit');
SELECT upsert_button('lease.export', 'Exporter les baux', 'Exporter', 'Lease', 'export', 'Download', 'outline', 'sm', 'button', 'Exporter les baux', 'Bouton pour exporter les baux', 6, true, 'Lease', 'read');

-- =================================================================
-- PAYMENT BUTTONS
-- =================================================================
SELECT upsert_button('payment.create', 'Enregistrer un paiement', 'Enregistrer un paiement', 'Payment', 'create', 'CreditCard', 'default', 'default', 'button', 'Enregistrer un nouveau paiement', 'Bouton pour enregistrer un nouveau paiement', 1, true, 'Payment', 'create');
SELECT upsert_button('payment.edit', 'Modifier un paiement', 'Modifier', 'Payment', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier le paiement', 'Bouton pour modifier un paiement', 2, true, 'Payment', 'edit');
SELECT upsert_button('payment.delete', 'Supprimer un paiement', 'Supprimer', 'Payment', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer le paiement', 'Bouton pour supprimer un paiement', 3, true, 'Payment', 'delete');
SELECT upsert_button('payment.view', 'Voir un paiement', 'Voir', 'Payment', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'Payment', 'read');
SELECT upsert_button('payment.export', 'Exporter les paiements', 'Exporter', 'Payment', 'export', 'Download', 'outline', 'sm', 'button', 'Exporter les paiements', 'Bouton pour exporter les paiements', 5, true, 'Payment', 'read');
SELECT upsert_button('payment.print', 'Imprimer un paiement', 'Imprimer', 'Payment', 'print', 'Printer', 'outline', 'sm', 'button', 'Imprimer le paiement', 'Bouton pour imprimer un paiement', 6, true, 'Payment', 'read');

-- =================================================================
-- JOURNAL ENTRY BUTTONS
-- =================================================================
SELECT upsert_button('journal.create', 'Créer une écriture', 'Nouvelle Écriture', 'JournalEntry', 'create', 'Plus', 'default', 'default', 'button', 'Créer une nouvelle écriture comptable', 'Bouton pour créer une nouvelle écriture comptable', 1, true, 'JournalEntry', 'create');
SELECT upsert_button('journal.edit', 'Modifier une écriture', 'Modifier', 'JournalEntry', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier l''écriture', 'Bouton pour modifier une écriture', 2, true, 'JournalEntry', 'edit');
SELECT upsert_button('journal.delete', 'Supprimer une écriture', 'Supprimer', 'JournalEntry', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer l''écriture', 'Bouton pour supprimer une écriture', 3, true, 'JournalEntry', 'delete');
SELECT upsert_button('journal.view', 'Voir une écriture', 'Voir', 'JournalEntry', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'JournalEntry', 'read');
SELECT upsert_button('journal.validate', 'Valider une écriture', 'Valider', 'JournalEntry', 'custom', 'CheckCircle', 'default', 'sm', 'button', 'Valider l''écriture', 'Bouton pour valider une écriture comptable', 5, true, 'JournalEntry', 'edit');
SELECT upsert_button('journal.export', 'Exporter les écritures', 'Exporter', 'JournalEntry', 'export', 'Download', 'outline', 'sm', 'button', 'Exporter les écritures', 'Bouton pour exporter les écritures', 6, true, 'JournalEntry', 'read');

-- =================================================================
-- TASK BUTTONS
-- =================================================================
SELECT upsert_button('task.create', 'Créer une tâche', 'Créer une tâche', 'Task', 'create', 'Plus', 'default', 'default', 'button', 'Créer une nouvelle tâche', 'Bouton pour créer une nouvelle tâche', 1, true, 'Task', 'create');
SELECT upsert_button('task.edit', 'Modifier une tâche', 'Modifier', 'Task', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier la tâche', 'Bouton pour modifier une tâche', 2, true, 'Task', 'edit');
SELECT upsert_button('task.delete', 'Supprimer une tâche', 'Supprimer', 'Task', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer la tâche', 'Bouton pour supprimer une tâche', 3, true, 'Task', 'delete');
SELECT upsert_button('task.view', 'Voir une tâche', 'Voir', 'Task', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'Task', 'read');
SELECT upsert_button('task.complete', 'Marquer comme terminée', 'Terminer', 'Task', 'custom', 'CheckCircle', 'outline', 'sm', 'button', 'Marquer la tâche comme terminée', 'Bouton pour marquer une tâche comme terminée', 5, true, 'Task', 'edit');

-- =================================================================
-- MESSAGE BUTTONS
-- =================================================================
SELECT upsert_button('message.create', 'Envoyer un message', 'Envoyer un message', 'Message', 'create', 'Send', 'default', 'default', 'button', 'Envoyer un nouveau message', 'Bouton pour envoyer un nouveau message', 1, true, 'Message', 'create');
SELECT upsert_button('message.edit', 'Modifier un message', 'Modifier', 'Message', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier le message', 'Bouton pour modifier un message', 2, true, 'Message', 'edit');
SELECT upsert_button('message.delete', 'Supprimer un message', 'Supprimer', 'Message', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer le message', 'Bouton pour supprimer un message', 3, true, 'Message', 'delete');
SELECT upsert_button('message.view', 'Voir un message', 'Voir', 'Message', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'Message', 'read');
SELECT upsert_button('message.mark_read', 'Marquer comme lu', 'Marquer lu', 'Message', 'custom', 'CheckCircle', 'outline', 'sm', 'button', 'Marquer le message comme lu', 'Bouton pour marquer un message comme lu', 5, true, 'Message', 'edit');

-- =================================================================
-- USER BUTTONS
-- =================================================================
SELECT upsert_button('user.create', 'Inviter un utilisateur', 'Inviter utilisateur', 'User', 'create', 'UserPlus', 'default', 'default', 'button', 'Inviter un nouvel utilisateur', 'Bouton pour inviter un nouvel utilisateur', 1, true, 'User', 'create');
SELECT upsert_button('user.edit', 'Modifier un utilisateur', 'Modifier', 'User', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier l''utilisateur', 'Bouton pour modifier un utilisateur', 2, true, 'User', 'edit');
SELECT upsert_button('user.delete', 'Supprimer un utilisateur', 'Supprimer', 'User', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer l''utilisateur', 'Bouton pour supprimer un utilisateur', 3, true, 'User', 'delete');
SELECT upsert_button('user.view', 'Voir un utilisateur', 'Voir', 'User', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'User', 'read');
SELECT upsert_button('user.activate', 'Activer un utilisateur', 'Activer', 'User', 'custom', 'UserCheck', 'outline', 'sm', 'button', 'Activer l''utilisateur', 'Bouton pour activer un utilisateur', 5, true, 'User', 'edit');
SELECT upsert_button('user.deactivate', 'Désactiver un utilisateur', 'Désactiver', 'User', 'custom', 'UserX', 'outline', 'sm', 'button', 'Désactiver l''utilisateur', 'Bouton pour désactiver un utilisateur', 6, true, 'User', 'edit');

-- =================================================================
-- ORGANIZATION BUTTONS
-- =================================================================
SELECT upsert_button('organization.edit', 'Modifier l''organisation', 'Modifier', 'Organization', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier l''organisation', 'Bouton pour modifier l''organisation', 1, true, 'Organization', 'edit');
SELECT upsert_button('organization.view', 'Voir l''organisation', 'Voir', 'Organization', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 2, true, 'Organization', 'read');
SELECT upsert_button('organization.settings', 'Paramètres', 'Paramètres', 'Organization', 'custom', 'Settings', 'outline', 'sm', 'button', 'Accéder aux paramètres', 'Bouton pour accéder aux paramètres', 3, true, 'Organization', 'read');

-- =================================================================
-- PROFILE BUTTONS
-- =================================================================
SELECT upsert_button('profile.create', 'Créer un profil', 'Créer un profil', 'Profile', 'create', 'Plus', 'default', 'default', 'button', 'Créer un nouveau profil', 'Bouton pour créer un nouveau profil', 1, true, 'Profile', 'create');
SELECT upsert_button('profile.edit', 'Modifier un profil', 'Modifier', 'Profile', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier le profil', 'Bouton pour modifier un profil', 2, true, 'Profile', 'edit');
SELECT upsert_button('profile.delete', 'Supprimer un profil', 'Supprimer', 'Profile', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer le profil', 'Bouton pour supprimer un profil', 3, true, 'Profile', 'delete');
SELECT upsert_button('profile.view', 'Voir un profil', 'Voir', 'Profile', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'Profile', 'read');

-- =================================================================
-- REPORT BUTTONS
-- =================================================================
SELECT upsert_button('report.create', 'Créer un rapport', 'Créer un rapport', 'Report', 'create', 'FileText', 'default', 'default', 'button', 'Créer un nouveau rapport', 'Bouton pour créer un nouveau rapport', 1, true, 'Report', 'create');
SELECT upsert_button('report.edit', 'Modifier un rapport', 'Modifier', 'Report', 'edit', 'Edit', 'outline', 'sm', 'button', 'Modifier le rapport', 'Bouton pour modifier un rapport', 2, true, 'Report', 'edit');
SELECT upsert_button('report.delete', 'Supprimer un rapport', 'Supprimer', 'Report', 'delete', 'Trash2', 'destructive', 'sm', 'button', 'Supprimer le rapport', 'Bouton pour supprimer un rapport', 3, true, 'Report', 'delete');
SELECT upsert_button('report.view', 'Voir un rapport', 'Voir', 'Report', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 4, true, 'Report', 'read');
SELECT upsert_button('report.export', 'Exporter un rapport', 'Exporter', 'Report', 'export', 'Download', 'outline', 'sm', 'button', 'Exporter le rapport', 'Bouton pour exporter un rapport', 5, true, 'Report', 'read');
SELECT upsert_button('report.print', 'Imprimer un rapport', 'Imprimer', 'Report', 'print', 'Printer', 'outline', 'sm', 'button', 'Imprimer le rapport', 'Bouton pour imprimer un rapport', 6, true, 'Report', 'read');

-- =================================================================
-- ACTIVITY BUTTONS
-- =================================================================
SELECT upsert_button('activity.view', 'Voir une activité', 'Voir', 'Activity', 'view', 'Eye', 'ghost', 'sm', 'button', 'Voir les détails', 'Bouton pour voir les détails', 1, true, 'Activity', 'read');
SELECT upsert_button('activity.export', 'Exporter les activités', 'Exporter', 'Activity', 'export', 'Download', 'outline', 'sm', 'button', 'Exporter les activités', 'Bouton pour exporter les activités', 2, true, 'Activity', 'read');

-- =================================================================
-- Sync buttons with all profiles
-- =================================================================
DO $$
DECLARE
    v_profile_record RECORD;
    v_button_record RECORD;
BEGIN
    RAISE NOTICE 'Synchronizing buttons with all profiles...';
    
    FOR v_profile_record IN
        SELECT id
        FROM profiles
        WHERE is_active = TRUE
    LOOP
        FOR v_button_record IN
            SELECT id
            FROM buttons
            WHERE is_active = TRUE
        LOOP
            INSERT INTO profile_buttons (
                profile_id,
                button_id,
                is_enabled,
                is_visible
            ) VALUES (
                v_profile_record.id,
                v_button_record.id,
                TRUE,
                TRUE
            )
            ON CONFLICT (profile_id, button_id) DO NOTHING;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Buttons synchronized with all profiles successfully!';
END $$;

-- Clean up function
DROP FUNCTION IF EXISTS upsert_button(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, TEXT, TEXT);

-- Final message
DO $$
BEGIN
    RAISE NOTICE 'All buttons loaded successfully for all objects!';
    RAISE NOTICE 'Total buttons: %', (SELECT COUNT(*) FROM buttons WHERE is_active = TRUE);
    RAISE NOTICE 'Total profile-button associations: %', (SELECT COUNT(*) FROM profile_buttons);
END $$;

