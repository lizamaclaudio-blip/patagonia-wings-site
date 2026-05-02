-- Diagnóstico cierres no evaluables / pending_server_closeout
-- Fecha: 2026-05-01
-- Objetivo: auditar trazabilidad y preparar reversa manual guiada.
-- IMPORTANTE: este script NO ejecuta cambios destructivos.

-- Parámetros de búsqueda flexible (sin asumir reservation_id).
-- Editar p_target_text con un valor identificador: callsign, route_code, fecha, fragmento de XML, etc.
with params as (
  select
    null::text as p_reservation_id,
    'PONER_AQUI_TEXTO_IDENTIFICADOR'::text as p_target_text
)
select * from params;


-- 1) Reservas en estado no evaluable / pendiente de cierre servidor.
with params as (
  select null::text as p_reservation_id, 'PONER_AQUI_TEXTO_IDENTIFICADOR'::text as p_target_text
)
select
  fr.id,
  fr.pilot_callsign,
  fr.route_code,
  fr.status,
  fr.scoring_status,
  fr.created_at,
  fr.completed_at,
  fr.updated_at,
  fr.commission_usd,
  fr.damage_deduction_usd
from flight_reservations fr
cross join params p
where (
  lower(coalesce(fr.scoring_status, '')) in ('pending_server_closeout', 'incomplete_closeout', 'no_evaluable')
  or lower(coalesce(fr.status, '')) in ('pending_server_closeout', 'incomplete_closeout', 'no_evaluable')
)
and (
  p.p_reservation_id is null
  or fr.id::text = p.p_reservation_id
  or fr.id::text ilike '%' || p.p_target_text || '%'
  or coalesce(fr.route_code, '') ilike '%' || p.p_target_text || '%'
  or coalesce(fr.pilot_callsign, '') ilike '%' || p.p_target_text || '%'
)
order by fr.updated_at desc
limit 200;


-- 2) Score payload / evidencia / eventos para validar por qué quedó no evaluable.
with params as (
  select null::text as p_reservation_id, 'PONER_AQUI_TEXTO_IDENTIFICADOR'::text as p_target_text
)
select
  fr.id,
  fr.pilot_callsign,
  fr.route_code,
  fr.scoring_status,
  fr.status,
  fr.score_payload,
  fr.score_payload -> 'closeout_evidence' as closeout_evidence,
  fr.score_payload -> 'closeout_warnings' as closeout_warnings,
  fr.score_payload -> 'events_json' as events_json,
  fr.score_payload -> 'penalties_json' as penalties_json,
  fr.score_payload -> 'official_closeout' as official_closeout
from flight_reservations fr
cross join params p
where (
  p.p_reservation_id is null
  or fr.id::text = p.p_reservation_id
  or fr.id::text ilike '%' || p.p_target_text || '%'
  or coalesce(fr.route_code, '') ilike '%' || p.p_target_text || '%'
  or coalesce(fr.pilot_callsign, '') ilike '%' || p.p_target_text || '%'
  or coalesce(fr.score_payload::text, '') ilike '%' || p.p_target_text || '%'
)
order by fr.updated_at desc
limit 200;


-- 3) Pilot salary ledger por búsqueda JSON/texto (sin asumir reservation_id).
with params as (
  select null::text as p_reservation_id, 'PONER_AQUI_TEXTO_IDENTIFICADOR'::text as p_target_text
)
select
  psl.id,
  psl.pilot_id,
  psl.pilot_callsign,
  psl.period_year,
  psl.period_month,
  psl.flights_count,
  psl.commission_total_usd,
  psl.base_salary_usd,
  psl.net_paid_usd,
  psl.status,
  psl.created_at,
  to_jsonb(psl) as row_json
from pilot_salary_ledger psl
cross join params p
where (
  p.p_reservation_id is null
  or coalesce(psl.pilot_callsign, '') ilike '%' || p.p_target_text || '%'
  or coalesce(to_jsonb(psl)::text, '') ilike '%' || p.p_target_text || '%'
)
order by psl.created_at desc nulls last
limit 200;


-- 4) Airline ledger por búsqueda JSON/texto (sin asumir reservation_id).
with params as (
  select null::text as p_reservation_id, 'PONER_AQUI_TEXTO_IDENTIFICADOR'::text as p_target_text
)
select
  al.id,
  al.created_at,
  al.entry_type,
  al.amount_usd,
  al.pilot_callsign,
  al.reservation_id,
  al.description,
  to_jsonb(al) as row_json
from airline_ledger al
cross join params p
where (
  p.p_reservation_id is null
  or coalesce(al.reservation_id::text, '') = p.p_reservation_id
  or coalesce(al.reservation_id::text, '') ilike '%' || p.p_target_text || '%'
  or coalesce(al.pilot_callsign, '') ilike '%' || p.p_target_text || '%'
  or coalesce(al.description, '') ilike '%' || p.p_target_text || '%'
  or coalesce(to_jsonb(al)::text, '') ilike '%' || p.p_target_text || '%'
)
order by al.created_at desc
limit 300;


-- 5) Snapshots de economía por búsqueda JSON/texto (sin asumir reservation_id).
with params as (
  select null::text as p_reservation_id, 'PONER_AQUI_TEXTO_IDENTIFICADOR'::text as p_target_text
)
select
  fes.id,
  fes.created_at,
  fes.reservation_id,
  fes.economy_source,
  fes.net_profit_usd,
  fes.pilot_payment_usd,
  fes.total_cost_usd,
  fes.metadata,
  to_jsonb(fes) as row_json
from flight_economy_snapshots fes
cross join params p
where (
  p.p_reservation_id is null
  or coalesce(fes.reservation_id::text, '') = p.p_reservation_id
  or coalesce(fes.reservation_id::text, '') ilike '%' || p.p_target_text || '%'
  or coalesce(fes.metadata::text, '') ilike '%' || p.p_target_text || '%'
  or coalesce(to_jsonb(fes)::text, '') ilike '%' || p.p_target_text || '%'
)
order by fes.created_at desc
limit 300;


-- 6) REVERSA MANUAL GUIADA (COMENTADA) - SOLO PARA UNA RESERVA ESPECÍFICA
--
-- PRECAUCIÓN:
-- - Descomentar una sola instrucción por vez.
-- - Verificar previamente con SELECT de arriba.
-- - Ejecutar dentro de transacción manual y validar antes de COMMIT.
--
-- begin;
--
-- -- 6.1) Eliminar asientos airline_ledger de una reserva específica.
-- -- delete from airline_ledger
-- -- where reservation_id = 'REEMPLAZAR_RESERVA_ID';
--
-- -- 6.2) Eliminar snapshots de economía de una reserva específica.
-- -- delete from flight_economy_snapshots
-- -- where reservation_id = 'REEMPLAZAR_RESERVA_ID';
--
-- -- 6.3) Marcar reserva como no evaluable/pending_server_closeout.
-- -- update flight_reservations
-- -- set
-- --   scoring_status = 'pending_server_closeout',
-- --   status = case when status = 'completed' then 'pending_server_closeout' else status end,
-- --   commission_usd = 0,
-- --   damage_deduction_usd = 0,
-- --   updated_at = now()
-- -- where id = 'REEMPLAZAR_RESERVA_ID';
--
-- -- 6.4) Recalcular o ajustar manualmente pilot_salary_ledger del piloto/período afectado.
-- -- update pilot_salary_ledger
-- -- set
-- --   commission_total_usd = greatest(0, commission_total_usd - REEMPLAZAR_MONTO_COMISION),
-- --   net_paid_usd = greatest(0, net_paid_usd - REEMPLAZAR_MONTO_COMISION),
-- --   updated_at = now()
-- -- where id = 'REEMPLAZAR_LEDGER_ID';
--
-- -- rollback;
-- -- commit;
