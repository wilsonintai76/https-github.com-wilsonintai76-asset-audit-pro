-- Working Solution for KPI Tier Schema Issue
-- This demonstrates the correct approach without using relationships

-- Step 1: Verify basic table access (these should work)
SELECT 'Step 1: Testing basic kpi_tiers access' as status;
SELECT id, name, min_assets, max_assets FROM kpi_tiers LIMIT 3;

-- Step 2: Verify basic targets table access
SELECT 'Step 2: Testing basic kpi_tier_targets access' as status;
SELECT id, tier_id, phase_id, target_percentage FROM kpi_tier_targets LIMIT 3;

-- Step 3: Show the CORRECT way to get data without relationships
SELECT 'Step 3: Manual join approach (this works)' as status;
SELECT 
    t.id as tier_id,
    t.name as tier_name,
    t.min_assets,
    t.max_assets,
    tt.phase_id,
    tt.target_percentage
FROM kpi_tiers t
LEFT JOIN kpi_tier_targets tt ON t.id = tt.tier_id
LIMIT 5;

-- Step 4: Show what the application should be doing
SELECT 'Step 4: Application approach - separate queries' as status;
-- First get tiers
SELECT 'Tiers:' as info, id, name, min_assets, max_assets FROM kpi_tiers;

-- Then get targets separately
SELECT 'Targets:' as info, id, tier_id, phase_id, target_percentage FROM kpi_tier_targets;

-- Step 5: Reload schema cache to clear any cached errors
SELECT 'Step 5: Reloading schema cache' as status;
NOTIFY pgrst, 'reload_schema';

SELECT 'Solution: Use separate queries or manual SQL joins, NOT PostgREST relationships' as final_status;
