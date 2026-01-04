-- =================================================================
-- Migration: Change navigation_items.required_feature_key to feature_id
-- =================================================================
-- This migration changes navigation_items to use feature_id (UUID FK to features.id)
-- instead of required_feature_key (TEXT FK to features.name) for better referential integrity
-- =================================================================

BEGIN;

-- Step 1: Add the new feature_id column (nullable initially)
ALTER TABLE navigation_items 
ADD COLUMN feature_id UUID;

-- Step 2: Populate feature_id based on required_feature_key
-- Match by features.name = navigation_items.required_feature_key
UPDATE navigation_items ni
SET feature_id = f.id
FROM features f
WHERE ni.required_feature_key = f.name
  AND ni.required_feature_key IS NOT NULL;

-- Step 3: Add foreign key constraint to features(id)
ALTER TABLE navigation_items
ADD CONSTRAINT fk_navigation_items_feature_id
FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE SET NULL;

-- Step 4: Drop the old foreign key constraint on required_feature_key
-- First, find and drop the constraint (it might have a generated name)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'navigation_items'::regclass
      AND confrelid = 'features'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%required_feature_key%';
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE navigation_items DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

-- Step 5: Drop the old index on required_feature_key (if it exists)
DROP INDEX IF EXISTS idx_navigation_items_feature;

-- Step 6: Create new index on feature_id
CREATE INDEX IF NOT EXISTS idx_navigation_items_feature_id 
ON navigation_items(feature_id) 
WHERE feature_id IS NOT NULL;

-- Step 7: Drop the old required_feature_key column
ALTER TABLE navigation_items 
DROP COLUMN IF EXISTS required_feature_key;

-- Step 8: Update comments
COMMENT ON COLUMN navigation_items.feature_id IS 'Feature du plan requise pour accéder à cet item (Plan Security Level) - FK vers features(id)';

COMMIT;

-- Verification query (run separately to check)
-- SELECT 
--     ni.id,
--     ni.key,
--     ni.name,
--     ni.feature_id,
--     f.name as feature_name,
--     f.id as feature_id_verified
-- FROM navigation_items ni
-- LEFT JOIN features f ON ni.feature_id = f.id
-- WHERE ni.feature_id IS NOT NULL
-- ORDER BY ni.key;


