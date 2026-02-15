-- =====================================================
-- FIRE Wealth: Optimization Results Tables
-- Run this SQL in Supabase SQL Editor to create tables
-- =====================================================

-- 1. optimization_runs - One row per optimization execution
CREATE TABLE IF NOT EXISTS optimization_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_name   text,
    simulation_count int,
    confidence_level int,
    entity_types    text[],
    asset_ids       text[],
    created_at      timestamptz DEFAULT now()
);

-- 2. optimization_results - One row per entity_type x portfolio (10 portfolios)
--    e.g. 3 entities × 10 portfolios = 30 rows per run
CREATE TABLE IF NOT EXISTS optimization_results (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id          uuid REFERENCES optimization_runs(id) ON DELETE CASCADE,
    entity_type     text NOT NULL,
    portfolio_id    int NOT NULL,
    portfolio_label text,
    expected_return numeric,
    risk            numeric,
    weights         jsonb,
    created_at      timestamptz DEFAULT now()
);

-- Index for fast lookups by run
CREATE INDEX IF NOT EXISTS idx_optimization_results_run_id
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
