-- Diagnóstico no destructivo para revisar reservas que quedaron a medio cierre.
-- Ejecutar en Supabase SQL Editor si necesitas confirmar estado de los 11 PIREPs.

select
  id,
  pilot_callsign,
  flight_number,
  origin_ident,
  destination_ident,
  status,
  scoring_status,
  final_score,
  procedure_score,
  performance_score,
  completed_at,
  updated_at,
  score_payload ->> 'source' as score_payload_source,
  score_payload ->> 'closeout_status' as closeout_status,
  score_payload ->> 'original_finalize_error' as original_finalize_error,
  score_payload ->> 'recovery_reason' as recovery_reason
from public.flight_reservations
where
  updated_at >= now() - interval '14 days'
  and (
    status in ('pending_server_closeout', 'no_evaluable', 'incomplete_closeout', 'manual_review')
    or scoring_status in ('no_evaluable', 'trace_only')
    or score_payload ->> 'original_finalize_error' = 'reservation_not_closed'
    or score_payload ->> 'source' = 'acars_pending_queue_recovery_v1'
  )
order by updated_at desc;
