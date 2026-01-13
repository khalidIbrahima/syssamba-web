-- Add max_properties, max_units, and max_users columns to plans table
-- max_properties: limits the number of properties (buildings/real estate) per organization
-- max_units: limits the number of units (apartments/lots) per organization
-- max_users: limits the number of users per organization

ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_properties INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_units INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_users INTEGER;

-- Add comments to the columns
COMMENT ON COLUMN plans.max_properties IS 'Maximum number of properties (buildings/real estate) allowed per organization. NULL means unlimited.';
COMMENT ON COLUMN plans.max_units IS 'Maximum number of units (apartments/lots) allowed per organization. NULL means unlimited.';
COMMENT ON COLUMN plans.max_users IS 'Maximum number of users allowed per organization. NULL means unlimited.';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_plans_max_properties ON plans(max_properties);
CREATE INDEX IF NOT EXISTS idx_plans_max_units ON plans(max_units);
CREATE INDEX IF NOT EXISTS idx_plans_max_users ON plans(max_users);

-- Update existing plans with default values (NULL = unlimited)
-- No need to update existing records as they will inherit NULL (unlimited) by default