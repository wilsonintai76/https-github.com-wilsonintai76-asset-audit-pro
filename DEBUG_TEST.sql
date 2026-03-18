-- Simple test to isolate the schema cache issue
-- Run this step by step in Supabase SQL Editor

-- Step 1: Test basic kpi_tiers query (should work)
SELECT 'Testing kpi_tiers table...' as status;
SELECT COUNT(*) as tier_count FROM kpi_tiers;

-- Step 2: Test basic kpi_tier_targets query (should work if table exists)
SELECT 'Testing kpi_tier_targets table...' as status;
SELECT COUNT(*) as target_count FROM kpi_tier_targets;

-- Step 3: Test if the problematic relationship query fails
SELECT 'Testing relationship query (this should show the error)...' as status;
-- This is the type of query that causes the schema cache error
SELECT *, kpi_tier_targets(phase_id, target_percentage) 
FROM kpi_tiers 
LIMIT 1;

-- Step 4: Show table structures
SELECT 'kpi_tiers structure:' as info;
\d kpi_tiers

SELECT 'kpi_tier_targets structure:' as info;
\d kpi_tier_targets

-- Step 5: Force schema cache reload
SELECT 'Reloading schema cache...' as status;
NOTIFY pgrst, 'reload_schema';
