-- =================================================================
-- Migration: Change plan_features.plan_name to plan_features.plan_id
-- =================================================================
-- This migration changes the plan_features table to use plan_id (FK) 
-- instead of plan_name (TEXT) for better referential integrity

BEGIN;

-- Step 1: Add new plan_id column
ALTER TABLE plan_features 
ADD COLUMN IF NOT EXISTS plan_id UUID;

-- Step 2: Populate plan_id from plans table based on plan_name
UPDATE plan_features pf
SET plan_id = p.id
FROM plans p
WHERE pf.plan_name = p.name
  AND pf.plan_id IS NULL;

-- Step 3: Make plan_id NOT NULL (after data migration)
ALTER TABLE plan_features 
ALTER COLUMN plan_id SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE plan_features
ADD CONSTRAINT fk_plan_features_plan_id 
FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;

-- Step 5: Drop old unique constraint on (plan_name, feature_key)
ALTER TABLE plan_features
DROP CONSTRAINT IF EXISTS plan_features_plan_name_feature_key_key;

-- Step 6: Create new unique constraint on (plan_id, feature_key)
ALTER TABLE plan_features
ADD CONSTRAINT plan_features_plan_id_feature_key_key 
UNIQUE (plan_id, feature_key);

-- Step 7: Drop old indexes
DROP INDEX IF EXISTS idx_plan_features_plan;
DROP INDEX IF EXISTS idx_plan_features_composite;

-- Step 8: Create new indexes
CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id 
ON plan_features(plan_id);

CREATE INDEX IF NOT EXISTS idx_plan_features_composite 
ON plan_features(plan_id, feature_key);

-- Step 9: Drop plan_name column (after all migrations are complete)
-- Note: We keep it temporarily for backward compatibility, remove in next migration
-- ALTER TABLE plan_features DROP COLUMN IF EXISTS plan_name;

COMMIT;

-- Add comments
COMMENT ON COLUMN plan_features.plan_id IS 'Foreign key to plans.id';
COMMENT ON CONSTRAINT fk_plan_features_plan_id ON plan_features IS 'Foreign key constraint linking plan_features to plans table';

