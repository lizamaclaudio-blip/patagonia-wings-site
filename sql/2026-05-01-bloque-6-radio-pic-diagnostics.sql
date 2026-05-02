-- Bloque 6 — Diagnóstico radio PIC / COM1-COM2
-- Solo lectura. Reemplazar el reservation_id cuando corresponda.

select
  id as reservation_id,
  status,
  scoring_status,
  score_payload->'official_closeout' as official_closeout,
  score_payload->'sur_style_summary'->>'pic_false_count' as pic_false_count,
  score_payload->'sur_style_summary'->>'pic_checks_total' as pic_checks_total,
  score_payload->'sur_style_summary'->>'pic_radio_source' as pic_radio_source,
  score_payload->'sur_style_summary'->>'pic_last_required_frequency_mhz' as pic_last_required_frequency_mhz,
  score_payload->'sur_style_summary'->>'com1_frequency_mhz' as com1_frequency_mhz,
  score_payload->'sur_style_summary'->>'com2_frequency_mhz' as com2_frequency_mhz,
  score_payload->'official_pirep'->>'raw_pirep_xml' as raw_pirep_xml
from public.flight_reservations
where id = 'REEMPLAZAR_RESERVATION_ID'::uuid;

-- Eventos PIC normalizados dentro del score_payload.
select
  event->>'code' as code,
  event->>'stage' as stage,
  event->>'severity' as severity,
  event->>'detail' as detail
from public.flight_reservations fr,
jsonb_array_elements(coalesce(fr.score_payload->'events_json', '[]'::jsonb)) event
where fr.id = 'REEMPLAZAR_RESERVATION_ID'::uuid
  and event->>'code' ilike '%PIC%';
