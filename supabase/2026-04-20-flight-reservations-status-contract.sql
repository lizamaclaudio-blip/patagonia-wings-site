-- Contrato unico de estados para web + ACARS:
-- reserved -> dispatched -> in_progress -> completed
-- Los estados legacy "dispatch_ready" e "in_flight" se migran al contrato actual.

update public.flight_reservations
set status = 'dispatched'
where status = 'dispatch_ready';

update public.flight_reservations
set status = 'in_progress'
where status = 'in_flight';

alter table public.flight_reservations
  drop constraint if exists flight_reservations_status_check;

alter table public.flight_reservations
  add constraint flight_reservations_status_check
  check (
    status = any (
      array[
        'reserved'::text,
        'dispatched'::text,
        'in_progress'::text,
        'completed'::text,
        'cancelled'::text,
        'interrupted'::text,
        'crashed'::text,
        'aborted'::text,
        'manual_review'::text
      ]
    )
  );
