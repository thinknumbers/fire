-- =====================================================
-- FIRE Wealth: Optimization Results Tables
-- Run this SQL in Supabase SQL Editor to create tables
-- =====================================================

-- Drop old tables if they exist from previous version
DROP TABLE IF EXISTS optimization_results;
DROP TABLE IF EXISTS optimization_runs;

-- 1. optimization_runs - One row per optimization execution
CREATE TABLE optimization_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_name   text,
    simulation_count int,
    confidence_level int,
    entity_types    text[],
    asset_ids       text[],
    created_at      timestamptz DEFAULT now()
);

-- 2. optimization_results - One row per simulation per entity type
--    Portfolios 1-10 are stored as columns for easy export
--    e.g. 500 sims × 3 entity types = 1,500 rows
CREATE TABLE optimization_results (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id          uuid REFERENCES optimization_runs(id) ON DELETE CASCADE,
    entity_type     text NOT NULL,
    simulation_num  int NOT NULL,

    -- Portfolio 1 (Defensive)
    p1_return       numeric,
    p1_risk         numeric,
    p1_weights      jsonb,

    -- Portfolio 2 (Conservative)
    p2_return       numeric,
    p2_risk         numeric,
    p2_weights      jsonb,

    -- Portfolio 3 (Moderate Conservative)
    p3_return       numeric,
    p3_risk         numeric,
    p3_weights      jsonb,

    -- Portfolio 4 (Moderate)
    p4_return       numeric,
    p4_risk         numeric,
    p4_weights      jsonb,

    -- Portfolio 5 (Balanced)
    p5_return       numeric,
    p5_risk         numeric,
    p5_weights      jsonb,

    -- Portfolio 6 (Balanced Growth)
    p6_return       numeric,
    p6_risk         numeric,
    p6_weights      jsonb,

    -- Portfolio 7 (Growth)
    p7_return       numeric,
    p7_risk         numeric,
    p7_weights      jsonb,

    -- Portfolio 8 (High Growth)
    p8_return       numeric,
    p8_risk         numeric,
    p8_weights      jsonb,

    -- Portfolio 9 (Aggressive)
    p9_return       numeric,
    p9_risk         numeric,
    p9_weights      jsonb,

    -- Portfolio 10 (High Aggressive)
    p10_return      numeric,
    p10_risk        numeric,
    p10_weights     jsonb,

    created_at      timestamptz DEFAULT now()
);

-- Index for fast lookups by run
CREATE INDEX idx_optimization_results_run_id
    ON optimization_results(run_id);

-- Enable Row Level Security (Supabase requirement)
ALTER TABLE optimization_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_results ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (matches existing app pattern using anon key)
CREATE POLICY "Allow anonymous access to optimization_runs"
    ON optimization_runs FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anonymous access to optimization_results"
    ON optimization_results FOR ALL
    USING (true)
    WITH CHECK (true);

-- RPC function to properly truncate and reset IDs
-- Called via: supabase.rpc('truncate_optimization_data')
CREATE OR REPLACE FUNCTION truncate_optimization_data()
RETURNS void AS $$
BEGIN
    TRUNCATE optimization_results RESTART IDENTITY;
    TRUNCATE optimization_runs CASCADE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
