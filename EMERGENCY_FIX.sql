-- EMERGENCY FIX - Complete elimination of any relationship queries
-- Run this if the schema cache error persists

-- Step 1: Drop any existing views/functions that might cause issues
DROP VIEW IF EXISTS kpi_tiers_with_targets CASCADE;
DROP FUNCTION IF EXISTS get_kpi_tiers_with_targets() CASCADE;

-- Step 2: Create a completely simple view with NO relationships
CREATE OR REPLACE VIEW kpi_tiers_simple AS
SELECT 
    id,
    name,
    min_assets,
    max_assets,
    '{}'::json as targets  -- Empty JSON object as default
FROM kpi_tiers;

-- Step 3: Test the simple view
SELECT 'Testing simple view:' as status;
SELECT * FROM kpi_tiers_simple LIMIT 3;

-- Step 4: Grant permissions
GRANT SELECT ON kpi_tiers_simple TO authenticated, anon, service_role;

-- Step 5: Create a simple function that returns basic tier data only
CREATE OR REPLACE FUNCTION get_kpi_tiers_basic()
RETURNS TABLE (
    id UUID,
    name TEXT,
    min_assets INTEGER,
    max_assets INTEGER,
    targets JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id,
        name,
        min_assets,
        max_assets,
        '{}'::json as targets
    FROM kpi_tiers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Test the basic function
SELECT 'Testing basic function:' as status;
SELECT * FROM get_kpi_tiers_basic() LIMIT 3;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION get_kpi_tiers_basic() TO authenticated, anon, service_role;

-- Step 8: AGGRESSIVE cache refresh
SELECT 'Aggressive cache refresh:' as status;
NOTIFY pgrst, 'reload_schema';
NOTIFY pgrst, 'reload_config';
NOTIFY pgrst, 'reload_schema';  -- Send twice to ensure it's processed

-- Step 9: Wait a moment and refresh again
SELECT pg_sleep(2);
NOTIFY pgrst, 'reload_schema';

SELECT 'Emergency fix completed. Test the application now.' as final_status;
