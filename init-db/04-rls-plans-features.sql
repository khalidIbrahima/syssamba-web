-- ===============================================
-- SAMBA ONE - Disable RLS for Plans & Features
-- These tables contain public catalog data and should be readable by all
-- ===============================================

-- Disable RLS on plans table
-- Plans are public catalog data that anyone should be able to view
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;

-- Disable RLS on features table
-- Features are public catalog data that anyone should be able to view
ALTER TABLE features DISABLE ROW LEVEL SECURITY;

-- Disable RLS on plan_features table
-- Plan-feature relationships are public catalog data that anyone should be able to view
ALTER TABLE plan_features DISABLE ROW LEVEL SECURITY;

-- Add helpful comments
COMMENT ON TABLE plans IS 'Public catalog of available subscription plans - RLS disabled for public read access';
COMMENT ON TABLE features IS 'Public catalog of available features - RLS disabled for public read access';
COMMENT ON TABLE plan_features IS 'Public catalog of plan-feature relationships - RLS disabled for public read access';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS disabled for plans, features, and plan_features tables';
  RAISE NOTICE '   These tables are now publicly readable as catalog data';
END $$;

