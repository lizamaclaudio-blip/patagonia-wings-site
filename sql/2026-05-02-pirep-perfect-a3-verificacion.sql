/* ============================================================
   PATAGONIA WINGS — VERIFICACIÓN PIREP PERFECT A3
   SOLO LECTURA
   ============================================================ */
select
  id,
  status,
  updated_at,
  score_payload->>'raw_pirep_file_name' as raw_pirep_file_name,
  length(coalesce(score_payload->>'raw_pirep_xml', '')) as raw_pirep_xml_chars,
  (score_payload->>'raw_pirep_xml') ilike '%<Capabilities>%' as has_capabilities,
  (score_payload->>'raw_pirep_xml') ilike '%<FlightPhaseSummary>%' as has_phase_summary,
  (score_payload->>'raw_pirep_xml') ilike '%<EventTimeline>%' as has_event_timeline,
  coalesce(
    score_payload->>'final_score',
    score_payload->>'finalScore',
    score_payload->>'score'
  ) as final_score,
  score_payload->>'scoring_status' as scoring_status,
  score_payload->'official_closeout'->>'scoring_status' as official_scoring_status
from public.flight_reservations
where score_payload::text ilike '%raw_pirep_xml%'
order by updated_at desc nulls last
limit 20;
