/* ============================================================
   PATAGONIA WINGS — PIREP PERFECT A4 VERIFICACION
   MODO: SOLO LECTURA
   OBJETIVO: confirmar score oficial, progression ledger y N/D no penalizable.
   ============================================================ */

select
  fr.id,
  fr.status,
  fr.scoring_status,
  fr.procedure_score,
  fr.performance_score,
  fr.mission_score,
  fr.actual_block_minutes,
  fr.score_payload->>'official_scoring_authority' as authority,
  fr.score_payload->>'acars_client_score_ignored' as acars_score_ignored,
  fr.score_payload->'officialScores' as official_scores,
  fr.score_payload->'pirep_perfect_scoring'->'evidence' as pirep_perfect_evidence,
  fr.score_payload->'pirep_perfect_scoring'->'unsupportedProtectedMetrics' as unsupported_protected_metrics,
  fr.score_payload->'pirep_perfect_scoring'->'detailedPoints' as detailed_points,
  fr.score_payload->'score_progression' as score_progression,
  fr.updated_at
from public.flight_reservations fr
order by fr.updated_at desc nulls last
limit 10;

select
  'pw_flight_score_reports' as table_name,
  reservation_id,
  pilot_callsign,
  procedure_score,
  mission_score,
  dispatch_points,
  preparation_points,
  taxi_out_points,
  takeoff_climb_points,
  cruise_points,
  approach_points,
  landing_points,
  taxi_in_shutdown_points,
  penalty_points,
  valid_for_progression,
  scored_at
from public.pw_flight_score_reports
order by scored_at desc nulls last
limit 10;

select
  'pw_pilot_score_ledger' as table_name,
  pilot_callsign,
  source_type,
  source_ref,
  flight_mode_code,
  flight_hours,
  procedure_score,
  mission_score,
  legado_credits,
  valid_for_progression,
  notes,
  created_at
from public.pw_pilot_score_ledger
order by created_at desc nulls last
limit 10;

select
  'pw_pilot_scores' as table_name,
  pilot_callsign,
  pulso_10,
  ruta_10,
  legado_points,
  valid_flights_in_window,
  progression_flights_total,
  is_provisional,
  updated_at
from public.pw_pilot_scores
order by updated_at desc nulls last
limit 10;
