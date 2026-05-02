-- Bloque 5 — Diagnóstico ACARS telemetría ↔ reglaje ↔ resumen Web
-- Solo lectura. Reemplazar el UUID por la reserva a revisar.

-- 1) Reserva y score_payload principal
select
  fr.id,
  fr.reservation_code,
  fr.route_code,
  fr.origin_ident,
  fr.destination_ident,
  fr.aircraft_type_code,
  fr.aircraft_registration,
  fr.status,
  fr.scoring_status,
  fr.evaluation_status,
  fr.completed_at,
  fr.actual_block_minutes,
  fr.procedure_score,
  fr.performance_score,
  fr.mission_score,
  fr.score_payload->>'evaluation_status' as payload_evaluation_status,
  fr.score_payload->>'scoring_status' as payload_scoring_status,
  fr.score_payload->>'landing_g_force' as landing_g_force,
  fr.score_payload->>'landing_vs_fpm' as landing_vs_fpm,
  fr.score_payload->>'fuel_start_kg' as fuel_start_kg,
  fr.score_payload->>'fuel_end_kg' as fuel_end_kg,
  fr.score_payload->>'fuel_used_kg' as fuel_used_kg,
  fr.score_payload->'closeout_evidence' as closeout_evidence,
  fr.score_payload->'sur_style_summary' as sur_style_summary
from public.flight_reservations fr
where fr.id = 'REEMPLAZAR_RESERVATION_ID'::uuid;

-- 2) Caja negra guardada en score_payload
select
  fr.id,
  fr.score_payload->'raw_telemetry_summary' as raw_telemetry_summary,
  fr.score_payload->'official_closeout'->'blackboxSummary' as blackbox_summary,
  fr.score_payload->'official_closeout'->'eventSummary' as event_summary,
  jsonb_array_length(coalesce(fr.score_payload->'telemetry_log', '[]'::jsonb)) as telemetry_log_rows
from public.flight_reservations fr
where fr.id = 'REEMPLAZAR_RESERVATION_ID'::uuid;

-- 3) Primeras/últimas muestras útiles si telemetry_log quedó guardado en score_payload
with samples as (
  select
    fr.id,
    elem.value as sample,
    elem.ordinality
  from public.flight_reservations fr
  cross join lateral jsonb_array_elements(coalesce(fr.score_payload->'telemetry_log', '[]'::jsonb)) with ordinality as elem(value, ordinality)
  where fr.id = 'REEMPLAZAR_RESERVATION_ID'::uuid
)
select
  ordinality,
  sample->>'capturedAtUtc' as captured_at,
  sample->>'latitude' as lat,
  sample->>'longitude' as lon,
  sample->>'altitudeFeet' as altitude_ft,
  sample->>'altitudeAGL' as agl_ft,
  sample->>'indicatedAirspeed' as ias,
  sample->>'groundSpeed' as gs,
  sample->>'verticalSpeed' as vs,
  sample->>'fuelKg' as fuel_kg,
  sample->>'totalWeightKg' as total_weight_kg,
  sample->>'gForce' as g_force,
  sample->>'landingG' as landing_g,
  sample->>'landingVS' as landing_vs,
  sample->>'onGround' as on_ground,
  sample->>'navLightsOn' as nav,
  sample->>'beaconLightsOn' as beacon,
  sample->>'strobeLightsOn' as strobe,
  sample->>'landingLightsOn' as landing_lights,
  sample->>'parkingBrake' as parking_brake,
  sample->>'transponderCode' as xpdr,
  sample->>'com2FrequencyMhz' as com2,
  sample->>'aircraftTitle' as aircraft_title,
  sample->>'detectedProfileCode' as profile
from samples
where ordinality <= 5
   or ordinality > (select greatest(count(*) - 5, 0) from samples)
order by ordinality;

-- 4) PIREP XML guardado, si existe
select
  pr.reservation_id,
  pr.pirep_file_name,
  pr.pirep_checksum,
  length(coalesce(pr.pirep_xml_content, pr.raw_pirep_xml, pr.payload_xml, '')) as xml_length,
  substring(coalesce(pr.pirep_xml_content, pr.raw_pirep_xml, pr.payload_xml, '') from '<TouchdownGForce>(.*?)</TouchdownGForce>') as xml_touchdown_g,
  substring(coalesce(pr.pirep_xml_content, pr.raw_pirep_xml, pr.payload_xml, '') from '<MaxGForce>(.*?)</MaxGForce>') as xml_max_g,
  substring(coalesce(pr.pirep_xml_content, pr.raw_pirep_xml, pr.payload_xml, '') from '<VientoSalidaVelocidad>(.*?)</VientoSalidaVelocidad>') as xml_dep_wind_speed,
  substring(coalesce(pr.pirep_xml_content, pr.raw_pirep_xml, pr.payload_xml, '') from '<VientoLlegadaVelocidad>(.*?)</VientoLlegadaVelocidad>') as xml_arr_wind_speed
from public.pirep_reports pr
where pr.reservation_id = 'REEMPLAZAR_RESERVATION_ID'::uuid
order by pr.created_at desc
limit 5;
