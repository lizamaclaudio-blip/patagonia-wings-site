-- Patagonia Wings · Bloque 4
-- Diagnóstico de trazabilidad ACARS → Web summary estilo SUR Air.
-- Solo lectura. No modifica datos.

-- 1) Últimos cierres ACARS/PIREP por reserva.
select
  fr.id as reservation_id,
  fr.reservation_code,
  fr.route_code,
  fr.pilot_callsign,
  fr.origin_ident,
  fr.destination_ident,
  fr.aircraft_type_code,
  fr.aircraft_registration,
  fr.status,
  fr.scoring_status,
  fr.completed_at,
  fr.actual_block_minutes,
  fr.procedure_score,
  fr.performance_score,
  fr.mission_score,
  fr.commission_usd,
  fr.damage_deduction_usd,
  fr.score_payload->>'evaluation_status' as evaluation_status,
  fr.score_payload->>'economy_eligible' as economy_eligible,
  fr.score_payload->>'sur_style_summary_version' as sur_style_summary_version,
  fr.score_payload->>'departure_wind_summary' as dep_wind,
  fr.score_payload->>'arrival_wind_summary' as arr_wind,
  fr.score_payload->>'pic_false_count' as pic_false,
  fr.score_payload->>'stall_seconds' as stall_seconds,
  fr.score_payload->>'overspeed_seconds' as overspeed_seconds,
  fr.score_payload->>'landing_g_force' as landing_g,
  fr.score_payload->>'landing_vs_fpm' as landing_vs_fpm,
  fr.score_payload->>'tow_dispatched_kg' as tow_dispatched_kg,
  fr.score_payload->>'tow_aircraft_kg' as tow_aircraft_kg,
  fr.score_payload->>'planned_fuel_kg' as planned_fuel_kg,
  fr.score_payload->>'fuel_start_kg' as fuel_start_kg,
  fr.score_payload->>'fuel_used_kg' as fuel_used_kg,
  fr.score_payload->>'fuel_end_kg' as fuel_end_kg,
  fr.score_payload->>'route' as route_text,
  fr.score_payload->>'simulator' as simulator,
  fr.score_payload->>'aircraft_title' as aircraft_title,
  fr.score_payload->'closeout_warnings' as closeout_warnings,
  fr.score_payload->'closeout_evidence' as closeout_evidence
from public.flight_reservations fr
where fr.pilot_callsign = 'PWG001'
order by coalesce(fr.completed_at, fr.updated_at, fr.created_at) desc
limit 20;

-- 2) Cruce por una reserva específica: reemplazar el UUID.
-- select
--   fr.id,
--   fr.status,
--   fr.scoring_status,
--   fr.score_payload,
--   psr.score_payload as score_report_payload,
--   pr.raw_pirep_xml,
--   pr.evaluated_pirep_xml,
--   fes.metadata as economy_metadata,
--   al_count.ledger_rows,
--   psl.period_year,
--   psl.period_month,
--   psl.flights_count,
--   psl.commission_total_usd,
--   psl.net_paid_usd
-- from public.flight_reservations fr
-- left join public.pw_flight_score_reports psr on psr.reservation_id = fr.id
-- left join public.pirep_reports pr on pr.reservation_id = fr.id
-- left join public.flight_economy_snapshots fes on fes.reservation_id = fr.id and fes.economy_source = 'actual'
-- left join lateral (
--   select count(*) as ledger_rows
--   from public.airline_ledger al
--   where al.reservation_id = fr.id
-- ) al_count on true
-- left join public.pilot_salary_ledger psl
--   on psl.pilot_callsign = fr.pilot_callsign
--  and psl.period_year = extract(year from coalesce(fr.completed_at, fr.updated_at))::int
--  and psl.period_month = extract(month from coalesce(fr.completed_at, fr.updated_at))::int
-- where fr.id = 'REEMPLAZAR_UUID_RESERVA';
