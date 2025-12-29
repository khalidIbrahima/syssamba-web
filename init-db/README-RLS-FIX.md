# Fix Plan Names Not Displaying

## Problem
Plan names are showing as IDs (e.g., "Plan 4c9a24e8") instead of their actual names (e.g., "Professional Plan") in the plan features management interface.

## Root Cause
The `plans`, `features`, and `plan_features` tables have Row Level Security (RLS) enabled, which is blocking the API from reading these tables when using the anonymous key. Since these are public catalog tables (like a product catalog), they should be readable by everyone.

## Solution
Disable RLS on these three tables to allow public read access.

## How to Apply the Fix

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `04-rls-plans-features.sql`
5. Click **Run** to execute the script

### Option 2: Via psql Command Line

```bash
# If you have direct database access
psql -h your-supabase-host -U postgres -d postgres -f init-db/04-rls-plans-features.sql
```

### Option 3: Via Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push --file init-db/04-rls-plans-features.sql
```

## What This Script Does

1. **Disables RLS** on the `plans` table
2. **Disables RLS** on the `features` table  
3. **Disables RLS** on the `plan_features` table
4. **Adds comments** documenting that these are public catalog tables

## After Applying

1. Refresh the plan features management page
2. All plan names should now display correctly:
   - "Freemium Plan"
   - "Starter Plan"
   - "Professional Plan"
   - "Enterprise Plan"

## Security Note

Disabling RLS on these tables is safe because:
- They contain public catalog data (like a product catalog on an e-commerce site)
- They don't contain sensitive user data or organization data
- Write access is still controlled at the application level (super-admin only)
- These tables are meant to be viewable by all users to see available plans

## Verification

After applying the fix, you can verify it worked by:

1. Checking the API logs - no more "Plan inferred from plan_features data" messages
2. Visiting `/admin/plan-features` - all plan cards should show proper names
3. All feature names should also display correctly

## Troubleshooting

If plan names still don't display after applying this fix:

1. **Check the plans table has data**:
   ```sql
   SELECT id, name, display_name FROM plans;
   ```
   
2. **Check the plan IDs match**:
   ```sql
   SELECT DISTINCT pf.plan_id, p.name 
   FROM plan_features pf
   LEFT JOIN plans p ON pf.plan_id = p.id
   WHERE p.id IS NULL;
   ```
   If this returns rows, it means there are plan_features with plan IDs that don't exist in the plans table.

3. **Re-run the seed scripts**:
   ```bash
   npm run seed:plan-features
   ```

