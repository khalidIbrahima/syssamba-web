-- 42-add-messaging-feature.sql
-- Add messaging feature to the features table and enable it for all plans

-- Add the messaging feature if it doesn't exist
INSERT INTO features (key, name, description, category, icon) VALUES
('messaging', 'Messagerie', 'Système de messagerie entre utilisateurs et locataires', 'notifications', 'MessageSquare')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon = EXCLUDED.icon,
    updated_at = NOW();

-- Enable messaging for all plans
-- Check if plan_id column exists (after migration) or use plan_name (before migration)
DO $$
DECLARE
    v_has_plan_id BOOLEAN;
    v_has_plan_name BOOLEAN;
BEGIN
    -- Check if plan_id column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plan_features' 
        AND column_name = 'plan_id'
    ) INTO v_has_plan_id;
    
    -- Check if plan_name column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plan_features' 
        AND column_name = 'plan_name'
    ) INTO v_has_plan_name;
    
    IF v_has_plan_id AND v_has_plan_name THEN
        -- Both columns exist (during migration) - populate both
        INSERT INTO plan_features (plan_id, plan_name, feature_key, is_enabled)
        SELECT id, name, 'messaging', true
        FROM plans
        ON CONFLICT (plan_id, feature_key) DO UPDATE SET
            is_enabled = true,
            updated_at = NOW();
    ELSIF v_has_plan_id THEN
        -- Only plan_id exists (after migration complete)
        INSERT INTO plan_features (plan_id, feature_key, is_enabled)
        SELECT id, 'messaging', true
        FROM plans
        ON CONFLICT (plan_id, feature_key) DO UPDATE SET
            is_enabled = true,
            updated_at = NOW();
    ELSE
        -- Only plan_name exists (before migration)
        INSERT INTO plan_features (plan_name, feature_key, is_enabled)
        SELECT name, 'messaging', true
        FROM plans
        ON CONFLICT (plan_name, feature_key) DO UPDATE SET
            is_enabled = true,
            updated_at = NOW();
    END IF;
END $$;

-- Log success
DO $$
BEGIN
    RAISE NOTICE '✓ Messaging feature added and enabled for all plans';
END $$;

