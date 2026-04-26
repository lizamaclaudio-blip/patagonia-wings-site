-- ============================================================
-- Patagonia Wings — Economy schema migration
-- Date: 2024-04-26
-- Safe, additive, idempotent. Run multiple times = no side-effects.
-- ============================================================

-- ── airline_ledger ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS airline_ledger (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type    TEXT        NOT NULL,           -- 'flight_income' | 'fuel_cost' | 'maintenance_cost' | 'pilot_payment' | 'repair_cost' | 'salary_payment' | 'initial_capital'
  amount_usd    NUMERIC(14,2) NOT NULL,
  pilot_callsign TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast filtering by type
CREATE INDEX IF NOT EXISTS idx_airline_ledger_entry_type ON airline_ledger(entry_type);
CREATE INDEX IF NOT EXISTS idx_airline_ledger_created_at ON airline_ledger(created_at DESC);

-- ── airlines ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS airlines (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL DEFAULT 'Patagonia Wings',
  balance_usd         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_revenue_usd   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_costs_usd     NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure at least one airline row exists
INSERT INTO airlines (name, balance_usd)
SELECT 'Patagonia Wings', 0
WHERE NOT EXISTS (SELECT 1 FROM airlines LIMIT 1);

-- ── pilot_salary_ledger ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS pilot_salary_ledger (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pilot_callsign         TEXT,
  period_year            INT         NOT NULL,
  period_month           INT         NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  flights_count          INT         NOT NULL DEFAULT 0,
  block_hours_total      NUMERIC(8,2) NOT NULL DEFAULT 0,
  commission_total_usd   NUMERIC(10,2) NOT NULL DEFAULT 0,
  base_salary_usd        NUMERIC(10,2) NOT NULL DEFAULT 0,
  damage_deductions_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_paid_usd           NUMERIC(10,2) NOT NULL DEFAULT 0,
  status                 TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'skipped'
  paid_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pilot_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_pilot_salary_ledger_pilot ON pilot_salary_ledger(pilot_id);
CREATE INDEX IF NOT EXISTS idx_pilot_salary_ledger_period ON pilot_salary_ledger(period_year DESC, period_month DESC);

-- ── Add missing columns if tables already exist ───────────────

-- pilot_salary_ledger: block_hours_total (may be absent in older schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pilot_salary_ledger' AND column_name = 'block_hours_total'
  ) THEN
    ALTER TABLE pilot_salary_ledger ADD COLUMN block_hours_total NUMERIC(8,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- pilot_salary_ledger: damage_deductions_usd alias column (alternate name used in some queries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pilot_salary_ledger' AND column_name = 'damage_deductions_usd'
  ) THEN
    ALTER TABLE pilot_salary_ledger ADD COLUMN damage_deductions_usd NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- pilot_profiles: wallet_balance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pilot_profiles' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE pilot_profiles ADD COLUMN wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 1000;
  END IF;
END $$;

-- flight_reservations: economic columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flight_reservations' AND column_name = 'commission_usd'
  ) THEN
    ALTER TABLE flight_reservations ADD COLUMN commission_usd NUMERIC(10,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flight_reservations' AND column_name = 'damage_deduction_usd'
  ) THEN
    ALTER TABLE flight_reservations ADD COLUMN damage_deduction_usd NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flight_reservations' AND column_name = 'airline_revenue_usd'
  ) THEN
    ALTER TABLE flight_reservations ADD COLUMN airline_revenue_usd NUMERIC(10,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flight_reservations' AND column_name = 'fuel_cost_usd'
  ) THEN
    ALTER TABLE flight_reservations ADD COLUMN fuel_cost_usd NUMERIC(10,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flight_reservations' AND column_name = 'maintenance_cost_usd'
  ) THEN
    ALTER TABLE flight_reservations ADD COLUMN maintenance_cost_usd NUMERIC(10,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flight_reservations' AND column_name = 'distance_nm'
  ) THEN
    ALTER TABLE flight_reservations ADD COLUMN distance_nm NUMERIC(8,1);
  END IF;
END $$;

-- pirep_reports: ensure nullable defaults to avoid NOT NULL failures
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pirep_reports' AND column_name = 'payload_xml'
    AND is_nullable = 'NO' AND column_default IS NULL
  ) THEN
    ALTER TABLE pirep_reports ALTER COLUMN payload_xml SET DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pirep_reports' AND column_name = 'flight_type'
    AND is_nullable = 'NO' AND column_default IS NULL
  ) THEN
    ALTER TABLE pirep_reports ALTER COLUMN flight_type SET DEFAULT 'CAREER';
  END IF;
END $$;

-- ── Seed initial capital (idempotent) ─────────────────────────
-- 58 pilots × $3,000 avg salary × 6 months buffer × 1.25 safety = $1,305,000

DO $$
DECLARE
  v_initial_capital NUMERIC := 1305000;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM airline_ledger WHERE entry_type = 'initial_capital') THEN
    INSERT INTO airline_ledger (entry_type, amount_usd, description)
    VALUES (
      'initial_capital',
      v_initial_capital,
      'Capital inicial aerolínea — 58 pilotos × $3,000 × 6 meses × 1.25'
    );

    -- Update airlines balance
    UPDATE airlines SET balance_usd = balance_usd + v_initial_capital
    WHERE id = (SELECT id FROM airlines LIMIT 1);
  END IF;
END $$;

-- ── Notify PostgREST to reload schema ─────────────────────────
NOTIFY pgrst, 'reload schema';
