-- Patagonia Wings Web / ACARS - Bloque 2
-- Fecha: 2026-05-01
-- Objetivo:
-- 1) Crear bitácora owner/admin para pruebas PIREP XML sin mover wallet ni ledger real.
-- 2) Entregar consultas de auditoría para la primera prueba completa despacho -> ACARS -> Supabase -> resumen web.
-- Seguridad:
-- - No modifica vuelos reales.
-- - No borra datos.
-- - No paga wallet.
-- - No genera ledger operativo.

create table if not exists public.acars_test_evaluations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  reservation_id uuid null references public.flight_reservations(id) on delete set null,
  fixture_name text not null,
  raw_pirep_xml text null,
  evaluation_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb
);

alter table public.acars_test_evaluations enable row level security;

-- Lectura propia/owner vía usuario autenticado. El endpoint owner usa service role para insertar.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'acars_test_evaluations'
      and policyname = 'acars_test_evaluations_select_own'
  ) then
    create policy acars_test_evaluations_select_own
      on public.acars_test_evaluations
      for select
      to authenticated
      using (created_by = auth.uid());
  end if;
end $$;

create index if not exists acars_test_evaluations_created_at_idx
  on public.acars_test_evaluations(created_at desc);

create index if not exists acars_test_evaluations_reservation_id_idx
  on public.acars_test_evaluations(reservation_id);

create index if not exists acars_test_evaluations_fixture_name_idx
  on public.acars_test_evaluations(fixture_name);

comment on table public.acars_test_evaluations is
  'Bitácora de pruebas owner/admin PIREP XML. Dry-run; no mueve wallet, salary ni airline ledger real.';

-- =============================================================
-- CONSULTAS DE AUDITORÍA PARA PEGAR EN SUPABASE
-- Reemplaza __RESERVATION_ID__ por el uuid real del vuelo.
-- =============================================================

-- 1. Reserva principal y estado de cierre.
-- select
--   id,
--   pilot_callsign,
--   route_code,
--   reservation_code,
--   origin_ident,
--   destination_ident,
--   aircraft_type_code,
--   aircraft_registration,
--   status,
--   scoring_status,
--   completed_at,
--   actual_block_minutes,
--   procedure_score,
--   performance_score,
--   mission_score,
--   commission_usd,
--   damage_deduction_usd,
--   score_payload->>'evaluation_status' as evaluation_status,
--   score_payload->>'economy_eligible' as economy_eligible,
--   score_payload->>'salary_accrued' as salary_accrued,
--   score_payload->>'ledger_written' as ledger_written,
--   score_payload->'closeout_evidence' as closeout_evidence,
--   score_payload->'closeout_warnings' as closeout_warnings
-- from public.flight_reservations
-- where id = '__RESERVATION_ID__'::uuid;

-- 2. Dispatch package asociado.
-- select
--   id,
--   reservation_id,
--   dispatch_status,
--   route_code,
--   origin_icao,
--   destination_icao,
--   aircraft_type_code,
--   aircraft_registration,
--   created_at,
--   updated_at
-- from public.dispatch_packages
-- where reservation_id = '__RESERVATION_ID__'::uuid
-- order by created_at desc;

-- 3. Score report oficial.
-- select
--   reservation_id,
--   procedure_score,
--   performance_score,
--   mission_score,
--   procedure_grade,
--   performance_grade,
--   scored_at,
--   score_payload->>'evaluation_status' as evaluation_status,
--   score_payload->>'scoring_status' as scoring_status,
--   score_payload->'penalties_json' as penalties,
--   score_payload->'events_json' as events
-- from public.pw_flight_score_reports
-- where reservation_id = '__RESERVATION_ID__'::uuid
-- order by scored_at desc;

-- 4. Snapshots economía planificado vs real.
-- select
--   reservation_id,
--   economy_source,
--   fuel_kg_estimated,
--   fuel_kg_actual,
--   block_minutes_estimated,
--   block_minutes_actual,
--   passenger_revenue_usd,
--   cargo_revenue_usd,
--   onboard_service_revenue_usd,
--   onboard_sales_revenue_usd,
--   fuel_cost_usd,
--   maintenance_cost_usd,
--   airport_fees_usd,
--   handling_cost_usd,
--   total_cost_usd,
--   net_profit_usd,
--   pilot_payment_usd,
--   repair_cost_usd,
--   metadata,
--   created_at
-- from public.flight_economy_snapshots
-- where reservation_id = '__RESERVATION_ID__'::uuid
-- order by created_at desc;

-- 5. Ledger aerolínea real del vuelo.
-- select
--   reservation_id,
--   entry_type,
--   amount_usd,
--   pilot_callsign,
--   description,
--   created_at
-- from public.airline_ledger
-- where reservation_id = '__RESERVATION_ID__'::uuid
-- order by created_at asc;

-- 6. Salary mensual del piloto asociado a la reserva.
-- select
--   psl.*
-- from public.pilot_salary_ledger psl
-- join public.flight_reservations fr on fr.pilot_id = psl.pilot_id
-- where fr.id = '__RESERVATION_ID__'::uuid
--   and psl.period_year = extract(year from coalesce(fr.completed_at, fr.updated_at, fr.created_at))::int
--   and psl.period_month = extract(month from coalesce(fr.completed_at, fr.updated_at, fr.created_at))::int
-- order by psl.created_at desc;

-- 7. Bitácora de pruebas XML owner/admin.
-- select
--   id,
--   created_at,
--   reservation_id,
--   fixture_name,
--   result_payload->>'finalStatus' as final_status,
--   result_payload->>'evaluationStatus' as evaluation_status,
--   result_payload->>'scoringStatus' as scoring_status,
--   result_payload->>'finalScore' as final_score,
--   result_payload->'warnings' as warnings
-- from public.acars_test_evaluations
-- order by created_at desc
-- limit 25;
