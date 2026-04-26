-- ================================================================
-- Pilot Wallet & Transfers — 2026-04-25
-- ================================================================

-- 1. Asegurar que nuevos pilotos arrancan con $1000
ALTER TABLE pilot_profiles
  ALTER COLUMN wallet_balance SET DEFAULT 1000;

-- 2. Acreditar $1000 a todos los pilotos existentes sin saldo
UPDATE pilot_profiles
SET wallet_balance = 1000
WHERE (wallet_balance IS NULL OR wallet_balance = 0);

-- 3. Tabla de historial de traslados
CREATE TABLE IF NOT EXISTS pilot_transfers (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id         uuid          NOT NULL REFERENCES pilot_profiles(id) ON DELETE CASCADE,
  transfer_type    text          NOT NULL,
  origin_icao      text          NOT NULL,
  destination_icao text          NOT NULL,
  cost_usd         numeric(10,2) NOT NULL CHECK (cost_usd >= 0),
  distance_km      numeric(10,2),
  label            text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pilot_transfers_type_check CHECK (
    transfer_type IN ('ground', 'flight_domestic', 'flight_regional', 'flight_international')
  )
);

-- 4. RLS
ALTER TABLE pilot_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilot_sees_own_transfers"
  ON pilot_transfers FOR SELECT
  USING (pilot_id = auth.uid());

CREATE POLICY "pilot_inserts_own_transfers"
  ON pilot_transfers FOR INSERT
  WITH CHECK (pilot_id = auth.uid());

-- 5. Índice de búsqueda por piloto
CREATE INDEX IF NOT EXISTS idx_pilot_transfers_pilot_id
  ON pilot_transfers (pilot_id, created_at DESC);
