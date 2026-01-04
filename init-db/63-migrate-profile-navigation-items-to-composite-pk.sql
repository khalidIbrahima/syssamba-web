-- =================================================================
-- SAMBA ONE - Migration: profile_navigation_items to Composite PK
-- Convert profile_navigation_items from id-based to composite PK
-- =================================================================

-- Step 1: Drop the existing primary key constraint if it exists
DO $$
BEGIN
    -- Check if id column exists and is primary key
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'profile_navigation_items' 
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name LIKE '%id%'
    ) THEN
        -- Drop the primary key constraint on id
        ALTER TABLE profile_navigation_items DROP CONSTRAINT IF EXISTS profile_navigation_items_pkey;
    END IF;
END $$;

-- Step 2: Drop the id column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profile_navigation_items' 
        AND column_name = 'id'
    ) THEN
        ALTER TABLE profile_navigation_items DROP COLUMN id;
    END IF;
END $$;

-- Step 3: Drop the unique constraint if it exists (we'll replace it with PK)
ALTER TABLE profile_navigation_items DROP CONSTRAINT IF EXISTS unique_profile_nav_item;

-- Step 4: Add composite primary key
DO $$
BEGIN
    -- Check if composite primary key already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'profile_navigation_items' 
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name = 'profile_navigation_items_pkey'
    ) THEN
        ALTER TABLE profile_navigation_items 
        ADD CONSTRAINT profile_navigation_items_pkey 
        PRIMARY KEY (profile_id, navigation_item_key);
    END IF;
END $$;

-- Step 5: Ensure indexes are in place
CREATE INDEX IF NOT EXISTS idx_profile_nav_profile ON profile_navigation_items(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_nav_item ON profile_navigation_items(navigation_item_key);
CREATE INDEX IF NOT EXISTS idx_profile_nav_enabled ON profile_navigation_items(profile_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_profile_nav_visible ON profile_navigation_items(profile_id, is_visible) WHERE is_visible = true;

-- Comment
COMMENT ON TABLE profile_navigation_items IS 'Junction table linking profiles to navigation items. Composite PRIMARY KEY: (profile_id, navigation_item_key)';

