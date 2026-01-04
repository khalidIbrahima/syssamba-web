-- 66-verify-and-enable-task-management.sql
-- Verify that task_management feature exists and enable it for all plans (including freemium for testing)

-- First, ensure the feature exists
INSERT INTO features (key, name, description, category, icon) VALUES
('task_management', 'Gestion des tâches', 'Système complet de gestion des tâches avec Kanban, assignation, et suivi', 'tasks', 'CheckSquare')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon = EXCLUDED.icon,
    updated_at = NOW();

-- Enable task_management for ALL plans (including freemium for testing)
-- This allows System Administrators to test the feature
DO $$
DECLARE
    v_has_plan_id BOOLEAN;
    v_has_plan_name BOOLEAN;
    v_has_feature_key BOOLEAN;
    v_has_feature_id BOOLEAN;
    v_feature_key TEXT := 'task_management';
    v_feature_id UUID;
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
    
    -- Check if feature_key column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plan_features' 
        AND column_name = 'feature_key'
    ) INTO v_has_feature_key;
    
    -- Check if feature_id column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plan_features' 
        AND column_name = 'feature_id'
    ) INTO v_has_feature_id;
    
    -- Get feature ID if feature_id column exists
    IF v_has_feature_id THEN
        SELECT id INTO v_feature_id FROM features WHERE key = v_feature_key;
    END IF;
    
    -- Enable task_management for ALL plans (including freemium)
    IF v_has_plan_id AND v_has_feature_key THEN
        -- Use feature_key (new schema)
        INSERT INTO plan_features (plan_id, feature_key, is_enabled)
        SELECT id, v_feature_key, true
        FROM plans
        ON CONFLICT (plan_id, feature_key) DO UPDATE SET
            is_enabled = true,
            updated_at = NOW();
    ELSIF v_has_plan_id AND v_has_feature_id AND v_feature_id IS NOT NULL THEN
        -- Use feature_id (alternative schema)
        INSERT INTO plan_features (plan_id, feature_id, is_enabled)
        SELECT id, v_feature_id, true
        FROM plans
        ON CONFLICT (plan_id, feature_id) DO UPDATE SET
            is_enabled = true,
            updated_at = NOW();
    ELSIF v_has_plan_id AND v_has_plan_name AND v_has_feature_key THEN
        -- Both columns exist (during migration) - populate both
        INSERT INTO plan_features (plan_id, plan_name, feature_key, is_enabled)
        SELECT id, name, v_feature_key, true
        FROM plans
        ON CONFLICT (plan_id, feature_key) DO UPDATE SET
            is_enabled = true,
            updated_at = NOW();
    ELSIF v_has_plan_name AND v_has_feature_key THEN
        -- Only plan_name exists (before migration)
        INSERT INTO plan_features (plan_name, feature_key, is_enabled)
        SELECT name, v_feature_key, true
        FROM plans
        ON CONFLICT (plan_name, feature_key) DO UPDATE SET
            is_enabled = true,
            updated_at = NOW();
    END IF;
END $$;

-- Verify the feature was added
DO $$
DECLARE
    v_feature_count INTEGER;
    v_plan_feature_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_feature_count FROM features WHERE key = 'task_management';
    SELECT COUNT(*) INTO v_plan_feature_count FROM plan_features WHERE feature_key = 'task_management';
    
    RAISE NOTICE '✓ Feature task_management: % row(s) in features table', v_feature_count;
    RAISE NOTICE '✓ Feature task_management: % row(s) in plan_features table', v_plan_feature_count;
    
    IF v_feature_count = 0 THEN
        RAISE WARNING '⚠️  Feature task_management not found in features table!';
    END IF;
    
    IF v_plan_feature_count = 0 THEN
        RAISE WARNING '⚠️  Feature task_management not linked to any plans!';
    ELSE
        RAISE NOTICE '✓ Feature task_management is enabled for % plan(s)', v_plan_feature_count;
    END IF;
END $$;

