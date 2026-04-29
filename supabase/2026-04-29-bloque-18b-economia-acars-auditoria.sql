-- ================================================================
-- Patagonia Wings Web · Bloque 18B
-- Auditoría economía + ACARS sin modificar datos
-- Fecha: 2026-04-29
-- Uso: copiar/pegar en Supabase SQL Editor.
-- ================================================================
-- Objetivo:
-- 1) Confirmar RLS/policies en tablas contables sensibles.
-- 2) Detectar vuelos completados sin snapshot ACARS real.
-- 3) Detectar reservas con economía en flight_reservations sin snapshot SimBrief.
-- 4) Detectar vuelos con economía pero sin movimientos contables en airline_ledger.
-- 5) Confirmar si el balance de airlines cuadra contra airline_ledger.
-- 6) Ver liquidaciones/sueldos existentes.
-- ================================================================

with target_tables as (
  select unnest(array[
    'airline_ledger',
    'flight_economy_snapshots',
    'pilot_salary_ledger',
    'pilot_expense_ledger',
    'airline_monthly_closures'
  ]) as table_name
),
rls_check as (
  select
    '01_RLS'::text as area,
    c.relname::text as object_name,
    case when c.relrowsecurity then 'RLS_ACTIVO' else 'RLS_INACTIVO' end::text as status,
    coalesce(string_agg(p.polname, ', ' order by p.polname), 'SIN_POLICIES')::text as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join target_tables t on t.table_name = c.relname
  left join pg_policy p on p.polrelid = c.oid
  where n.nspname = 'public'
  group by c.relname, c.relrowsecurity
),
completed_without_actual_snapshot as (
  select
    '02_SNAPSHOT_ACTUAL'::text as area,
    r.id::text as object_name,
    'COMPLETED_SIN_SNAPSHOT_ACTUAL'::text as status,
    concat(
      coalesce(r.flight_number, r.route_code, 'vuelo'), ' ',
      coalesce(r.origin_ident, '???'), '→',
      coalesce(r.destination_ident, '???'),
      ' status=', coalesce(r.status, 'null'),
      ' completed_at=', coalesce(r.completed_at::text, 'sin fecha'),
      ' net_profit=', coalesce(r.net_profit_usd::text, 'null'),
      ' commission=', coalesce(r.commission_usd::text, 'null')
    )::text as detail
  from public.flight_reservations r
  left join public.flight_economy_snapshots s
    on s.reservation_id = r.id
   and s.economy_source = 'actual'
  where lower(coalesce(r.status, '')) in ('completed', 'closed', 'finalized', 'finished')
    and s.id is null
  order by r.completed_at desc nulls last, r.updated_at desc nulls last
  limit 25
),
economy_reservation_without_simbrief_snapshot as (
  select
    '03_SNAPSHOT_SIMBRIEF'::text as area,
    r.id::text as object_name,
    'ECONOMIA_RESERVA_SIN_SNAPSHOT_SIMBRIEF'::text as status,
    concat(
      coalesce(r.flight_number, r.route_code, 'vuelo'), ' ',
      coalesce(r.origin_ident, '???'), '→',
      coalesce(r.destination_ident, '???'),
      ' status=', coalesce(r.status, 'null'),
      ' airline_revenue=', coalesce(r.airline_revenue_usd::text, 'null'),
      ' net_profit=', coalesce(r.net_profit_usd::text, 'null'),
      ' pax=', coalesce(r.estimated_passengers::text, 'null'),
      ' cargo_kg=', coalesce(r.estimated_cargo_kg::text, 'null')
    )::text as detail
  from public.flight_reservations r
  left join public.flight_economy_snapshots s
    on s.reservation_id = r.id
   and s.economy_source = 'simbrief'
  where (
      r.airline_revenue_usd is not null
      or r.net_profit_usd is not null
      or r.fuel_cost_usd is not null
      or r.estimated_passengers is not null
      or r.estimated_cargo_kg is not null
    )
    and s.id is null
  order by r.updated_at desc nulls last, r.created_at desc nulls last
  limit 25
),
economy_reservation_without_ledger as (
  select
    '04_LEDGER_POR_VUELO'::text as area,
    r.id::text as object_name,
    'ECONOMIA_SIN_MOVIMIENTOS_LEDGER'::text as status,
    concat(
      coalesce(r.flight_number, r.route_code, 'vuelo'), ' ',
      coalesce(r.origin_ident, '???'), '→',
      coalesce(r.destination_ident, '???'),
      ' status=', coalesce(r.status, 'null'),
      ' airline_revenue=', coalesce(r.airline_revenue_usd::text, 'null'),
      ' total_cost=', coalesce(r.total_cost_usd::text, 'null'),
      ' net_profit=', coalesce(r.net_profit_usd::text, 'null'),
      ' commission=', coalesce(r.commission_usd::text, 'null')
    )::text as detail
  from public.flight_reservations r
  left join public.airline_ledger l
    on l.reservation_id = r.id
  where (
      r.airline_revenue_usd is not null
      or r.net_profit_usd is not null
      or r.commission_usd is not null
    )
    and l.id is null
  order by r.updated_at desc nulls last, r.created_at desc nulls last
  limit 25
),
ledger_balance as (
  select
    '05_LEDGER_BALANCE'::text as area,
    a.id::text as object_name,
    case
      when round(coalesce(sum(l.amount_usd), 0)::numeric, 2) = round(coalesce(a.balance_usd, 0)::numeric, 2)
        then 'CUADRA'
      else 'NO_CUADRA'
    end::text as status,
    concat(
      'balance_airlines=', coalesce(a.balance_usd::text, 'null'),
      ' ledger_sum=', round(coalesce(sum(l.amount_usd), 0)::numeric, 2),
      ' diferencia=', round((coalesce(a.balance_usd, 0) - coalesce(sum(l.amount_usd), 0))::numeric, 2)
    )::text as detail
  from public.airlines a
  left join public.airline_ledger l on l.airline_id = a.id
  group by a.id, a.balance_usd
),
salary_rows as (
  select
    '06_SALARY'::text as area,
    coalesce(pilot_callsign, pilot_id::text)::text as object_name,
    status::text as status,
    concat(
      period_year, '-', lpad(period_month::text, 2, '0'),
      ' flights=', flights_count,
      ' block_hours=', coalesce(block_hours_total::text, '0'),
      ' commission=', commission_total_usd,
      ' base=', base_salary_usd,
      ' damage=', damage_deductions_usd,
      ' net=', net_paid_usd,
      ' paid_at=', coalesce(paid_at::text, 'pendiente')
    )::text as detail
  from public.pilot_salary_ledger
  order by period_year desc, period_month desc, created_at desc
  limit 25
),
data_summary as (
  select '00_RESUMEN'::text as area, 'flight_economy_snapshots_total'::text as object_name, count(*)::text as status, 'total snapshots económicos'::text as detail
  from public.flight_economy_snapshots
  union all
  select '00_RESUMEN', 'flight_economy_snapshots_simbrief', count(*)::text, 'snapshots planificados SimBrief'
  from public.flight_economy_snapshots where economy_source = 'simbrief'
  union all
  select '00_RESUMEN', 'flight_economy_snapshots_actual', count(*)::text, 'snapshots reales ACARS'
  from public.flight_economy_snapshots where economy_source = 'actual'
  union all
  select '00_RESUMEN', 'airline_ledger_total', count(*)::text, 'movimientos contables totales'
  from public.airline_ledger
  union all
  select '00_RESUMEN', 'pilot_salary_ledger_total', count(*)::text, 'liquidaciones/acumulados de sueldo'
  from public.pilot_salary_ledger
  union all
  select '00_RESUMEN', 'monthly_closures_total', count(*)::text, 'cierres mensuales aerolínea'
  from public.airline_monthly_closures
  union all
  select '00_RESUMEN', 'reservas_con_economia', count(*)::text, 'reservas con utilidad/ingresos/comisión'
  from public.flight_reservations
  where airline_revenue_usd is not null or net_profit_usd is not null or commission_usd is not null
)
select * from data_summary
union all select * from rls_check
union all select * from completed_without_actual_snapshot
union all select * from economy_reservation_without_simbrief_snapshot
union all select * from economy_reservation_without_ledger
union all select * from ledger_balance
union all select * from salary_rows
order by area, object_name;
