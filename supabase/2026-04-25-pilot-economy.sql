-- ================================================================
-- Pilot Economy System — 2026-04-25
-- Comisiones, sueldo mensual y deducciones por daño
-- ================================================================

-- 1. Columnas de economía en flight_reservations
ALTER TABLE flight_reservations
  ADD COLUMN IF NOT EXISTS commission_usd        numeric(10,2),
  ADD COLUMN IF NOT EXISTS damage_deduction_usd  numeric(10,2) DEFAULT 0;

-- 2. Registro de sueldos mensuales por piloto
CREATE TABLE IF NOT EXISTS pilot_salary_ledger (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id              uuid          NOT NULL REFERENCES pilot_profiles(id) ON DELETE CASCADE,
  period_year           int           NOT NULL,
  period_month          int           NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  flights_count         int           NOT NULL DEFAULT 0,
  commission_total_usd  numeric(10,2) NOT NULL DEFAULT 0,
  base_salary_usd       numeric(10,2) NOT NULL DEFAULT 0,   -- $1500 si ≥5 vuelos, 0 si no
  damage_deductions_usd numeric(10,2) NOT NULL DEFAULT 0,
  net_paid_usd          numeric(10,2) NOT NULL DEFAULT 0,
  paid_at               timestamptz,
  status                text          NOT NULL DEFAULT 'pending',
  notes                 text,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT salary_ledger_period_unique UNIQUE (pilot_id, period_year, period_month),
  CONSTRAINT salary_ledger_status_check CHECK (status IN ('pending', 'paid', 'skipped'))
);

-- 3. RLS
ALTER TABLE pilot_salary_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilot_sees_own_salary"
  ON pilot_salary_ledger FOR SELECT
  USING (pilot_id = auth.uid());

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_salary_ledger_pilot
  ON pilot_salary_ledger (pilot_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_flight_reservations_commission
  ON flight_reservations (pilot_id, commission_usd)
  WHERE commission_usd IS NOT NULL;
