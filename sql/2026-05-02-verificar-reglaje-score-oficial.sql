/* Patagonia Wings — verificación posterior a hotfix reglaje oficial Web/Supabase
   Solo lectura. */

select
  fr.id,
  fr.pilot_callsign,
  fr.status,
  fr.scoring_status,
  fr.completed_at,
  fr.score_payload->>'official_scoring_authority' as official_scoring_authority,
  fr.score_payload->>'acars_client_score_ignored' as acars_client_score_ignored,
  fr.score_payload->'official_closeout'->>'scoring_status' as official_closeout_scoring_status,
  fr.score_payload->>'final_score' as final_score,
  fr.score_payload->'official_scoring_reglaje'->'counts' as reglaje_counts,
  fr.score_payload->'score_progression' as score_progression
from public.flight_reservations fr
where fr.score_payload ? 'official_scoring_authority'
order by fr.completed_at desc nulls last, fr.updated_at desc nulls last
limit 20;

select
  pilot_callsign,
  pulso_10,
  ruta_10,
  legado_points,
  progression_flights_total,
  valid_flights_in_window,
  updated_at
from public.pw_pilot_scores
order by updated_at desc
limit 20;

select
  pilot_callsign,
  source_type,
  source_ref,
  flight_hours,
  procedure_score,
  mission_score,
  legado_credits,
  notes,
  created_at
from public.pw_pilot_score_ledger
order by created_at desc
limit 30;
