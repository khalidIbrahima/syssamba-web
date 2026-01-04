-- =================================================================
-- SAMBA ONE - Sync Buttons with Object Permissions
-- Automatically sync button permissions based on object permissions
-- =================================================================

-- Function to sync button permissions when object permissions change
CREATE OR REPLACE FUNCTION sync_buttons_with_object_permissions()
RETURNS TRIGGER AS $$
DECLARE
    v_button_record RECORD;
    v_action TEXT;
    v_should_enable BOOLEAN;
    v_profile_exists BOOLEAN;
BEGIN
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = NEW.profile_id) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
        RAISE NOTICE 'Profile % does not exist, skipping button sync', NEW.profile_id;
        RETURN NEW;
    END IF;
    
    -- Determine which action to check based on the button action
    -- Map button actions to object permission fields
    FOR v_button_record IN 
        SELECT id, object_type, action
        FROM buttons
        WHERE object_type = NEW.object_type
        AND is_active = TRUE
    LOOP
        -- Map button action to object permission
        v_action := v_button_record.action;
        v_should_enable := FALSE;
        
        -- Map button actions to object permissions
        CASE v_action
            WHEN 'create' THEN
                v_should_enable := NEW.can_create;
            WHEN 'read', 'view' THEN
                v_should_enable := NEW.can_read;
            WHEN 'update', 'edit' THEN
                v_should_enable := NEW.can_edit;
            WHEN 'delete' THEN
                v_should_enable := NEW.can_delete;
            WHEN 'export', 'import', 'print', 'custom' THEN
                -- For custom actions, check if user has read permission at minimum
                v_should_enable := NEW.can_read;
            ELSE
                -- Default: check read permission
                v_should_enable := NEW.can_read;
        END CASE;
        
        -- Insert or update profile_button association
        INSERT INTO profile_buttons (
            profile_id,
            button_id,
            is_enabled,
            is_visible
        ) VALUES (
            NEW.profile_id,
            v_button_record.id,
            v_should_enable,
            v_should_enable  -- Visible only if enabled
        )
        ON CONFLICT (profile_id, button_id)
        DO UPDATE SET
            is_enabled = v_should_enable,
            is_visible = v_should_enable,
            updated_at = NOW();
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT or UPDATE of profile_object_permissions
CREATE TRIGGER trigger_sync_buttons_on_object_permission_change
    AFTER INSERT OR UPDATE ON profile_object_permissions
    FOR EACH ROW
    EXECUTE FUNCTION sync_buttons_with_object_permissions();

-- Function to sync all buttons for a profile when object permissions are created/updated
-- This handles the case where buttons might be created after permissions
CREATE OR REPLACE FUNCTION sync_all_buttons_for_profile(p_profile_id UUID)
RETURNS VOID AS $$
DECLARE
    v_permission_record RECORD;
    v_button_record RECORD;
    v_action TEXT;
    v_should_enable BOOLEAN;
    v_profile_exists BOOLEAN;
BEGIN
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_profile_id) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
        RAISE NOTICE 'Profile % does not exist, skipping sync', p_profile_id;
        RETURN;
    END IF;
    
    -- Loop through all object permissions for this profile
    FOR v_permission_record IN
        SELECT object_type, can_create, can_read, can_edit, can_delete
        FROM profile_object_permissions
        WHERE profile_id = p_profile_id
    LOOP
        -- Loop through all buttons for this object type
        FOR v_button_record IN
            SELECT id, action
            FROM buttons
            WHERE object_type = v_permission_record.object_type
            AND is_active = TRUE
        LOOP
            v_action := v_button_record.action;
            v_should_enable := FALSE;
            
            -- Map button action to object permission
            CASE v_action
                WHEN 'create' THEN
                    v_should_enable := v_permission_record.can_create;
                WHEN 'read', 'view' THEN
                    v_should_enable := v_permission_record.can_read;
                WHEN 'update', 'edit' THEN
                    v_should_enable := v_permission_record.can_edit;
                WHEN 'delete' THEN
                    v_should_enable := v_permission_record.can_delete;
                WHEN 'export', 'import', 'print', 'custom' THEN
                    v_should_enable := v_permission_record.can_read;
                ELSE
                    v_should_enable := v_permission_record.can_read;
            END CASE;
            
            -- Insert or update profile_button association
            INSERT INTO profile_buttons (
                profile_id,
                button_id,
                is_enabled,
                is_visible
            ) VALUES (
                p_profile_id,
                v_button_record.id,
                v_should_enable,
                v_should_enable
            )
            ON CONFLICT (profile_id, button_id)
            DO UPDATE SET
                is_enabled = v_should_enable,
                is_visible = v_should_enable,
                updated_at = NOW();
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to sync buttons when a new button is created
CREATE OR REPLACE FUNCTION sync_buttons_on_button_create()
RETURNS TRIGGER AS $$
DECLARE
    v_permission_record RECORD;
    v_should_enable BOOLEAN;
    v_profile_exists BOOLEAN;
BEGIN
    -- If button is not active, skip
    IF NOT NEW.is_active THEN
        RETURN NEW;
    END IF;
    
    -- Loop through all profiles that have permissions for this object type
    FOR v_permission_record IN
        SELECT pop.profile_id, pop.can_create, pop.can_read, pop.can_edit, pop.can_delete
        FROM profile_object_permissions pop
        INNER JOIN profiles p ON p.id = pop.profile_id
        WHERE pop.object_type = NEW.object_type
        AND p.is_active = TRUE
    LOOP
        -- Verify profile still exists
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_permission_record.profile_id) INTO v_profile_exists;
        
        IF NOT v_profile_exists THEN
            CONTINUE;
        END IF;
        v_should_enable := FALSE;
        
        -- Map button action to object permission
        CASE NEW.action
            WHEN 'create' THEN
                v_should_enable := v_permission_record.can_create;
            WHEN 'read', 'view' THEN
                v_should_enable := v_permission_record.can_read;
            WHEN 'update', 'edit' THEN
                v_should_enable := v_permission_record.can_edit;
            WHEN 'delete' THEN
                v_should_enable := v_permission_record.can_delete;
            WHEN 'export', 'import', 'print', 'custom' THEN
                v_should_enable := v_permission_record.can_read;
            ELSE
                v_should_enable := v_permission_record.can_read;
        END CASE;
        
        -- Insert profile_button association
        INSERT INTO profile_buttons (
            profile_id,
            button_id,
            is_enabled,
            is_visible
        ) VALUES (
            v_permission_record.profile_id,
            NEW.id,
            v_should_enable,
            v_should_enable
        )
        ON CONFLICT (profile_id, button_id)
        DO UPDATE SET
            is_enabled = v_should_enable,
            is_visible = v_should_enable,
            updated_at = NOW();
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT of buttons
CREATE TRIGGER trigger_sync_buttons_on_button_create
    AFTER INSERT ON buttons
    FOR EACH ROW
    WHEN (NEW.is_active = TRUE)
    EXECUTE FUNCTION sync_buttons_on_button_create();

-- Initial sync: Sync all existing buttons with existing object permissions
-- This ensures all buttons are properly synced when the system is first set up
DO $$
DECLARE
    v_profile_record RECORD;
    v_profile_exists BOOLEAN;
    v_synced_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting initial sync of buttons with object permissions...';
    
    FOR v_profile_record IN
        SELECT DISTINCT pop.profile_id
        FROM profile_object_permissions pop
        INNER JOIN profiles p ON p.id = pop.profile_id
        WHERE p.is_active = TRUE
    LOOP
        -- Double check profile exists before syncing
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_profile_record.profile_id) INTO v_profile_exists;
        
        IF v_profile_exists THEN
            PERFORM sync_all_buttons_for_profile(v_profile_record.profile_id);
            v_synced_count := v_synced_count + 1;
        ELSE
            v_skipped_count := v_skipped_count + 1;
            RAISE NOTICE 'Skipping profile % (does not exist)', v_profile_record.profile_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Initial sync completed! Synced: %, Skipped: %', v_synced_count, v_skipped_count;
END $$;

-- Commentaires pour documentation
COMMENT ON FUNCTION sync_buttons_with_object_permissions() IS 'Synchronise automatiquement les permissions de boutons avec les permissions d''objet quand celles-ci changent';
COMMENT ON FUNCTION sync_all_buttons_for_profile(UUID) IS 'Synchronise tous les boutons pour un profil donné en fonction de ses permissions d''objet';
COMMENT ON FUNCTION sync_buttons_on_button_create() IS 'Synchronise les permissions de boutons quand un nouveau bouton est créé';
COMMENT ON TRIGGER trigger_sync_buttons_on_object_permission_change ON profile_object_permissions IS 'Déclenche la synchronisation des boutons quand les permissions d''objet changent';
COMMENT ON TRIGGER trigger_sync_buttons_on_button_create ON buttons IS 'Déclenche la synchronisation des permissions quand un nouveau bouton est créé';

