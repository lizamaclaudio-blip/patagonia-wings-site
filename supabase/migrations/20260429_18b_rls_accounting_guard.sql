-- ================================================================
-- Bloque 18B - Conector contable ACARS/economía
-- Objetivo: RLS mínimo para snapshots planificados y blindaje de escrituras cliente
-- Tipo: estructura/policies (no modifica datos contables)
-- ================================================================

alter table if exists public.flight_economy_snapshots enable row level security;
alter table if exists public.airline_ledger enable row level security;
alter table if exists public.pilot_salary_ledger enable row level security;
alter table if exists public.pilot_expense_ledger enable row level security;
alter table if exists public.airline_monthly_closures enable row level security;

-- Snapshot planificado propio (SimBrief/OFP) para cliente autenticado.
drop policy if exists pwg_snapshots_select_own on public.flight_economy_snapshots;
drop policy if exists pwg_snapshots_insert_own on public.flight_economy_snapshots;
drop policy if exists pwg_snapshots_update_own on public.flight_economy_snapshots;
drop policy if exists pwg_snapshots_delete_own on public.flight_economy_snapshots;

create policy pwg_snapshots_select_own
on public.flight_economy_snapshots
for select
to authenticated
using (
  pilot_id = auth.uid()
  or exists (
    select 1
    from public.pilot_profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.callsign, '')) = upper(coalesce(flight_economy_snapshots.pilot_callsign, ''))
  )
);

create policy pwg_snapshots_insert_own
on public.flight_economy_snapshots
for insert
to authenticated
with check (
  pilot_id = auth.uid()
  or exists (
    select 1
    from public.pilot_profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.callsign, '')) = upper(coalesce(flight_economy_snapshots.pilot_callsign, ''))
  )
);

create policy pwg_snapshots_update_own
on public.flight_economy_snapshots
for update
to authenticated
using (
  pilot_id = auth.uid()
  or exists (
    select 1
    from public.pilot_profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.callsign, '')) = upper(coalesce(flight_economy_snapshots.pilot_callsign, ''))
  )
)
with check (
  pilot_id = auth.uid()
  or exists (
    select 1
    from public.pilot_profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.callsign, '')) = upper(coalesce(flight_economy_snapshots.pilot_callsign, ''))
  )
);

create policy pwg_snapshots_delete_own
on public.flight_economy_snapshots
for delete
to authenticated
using (
  pilot_id = auth.uid()
  or exists (
    select 1
    from public.pilot_profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.callsign, '')) = upper(coalesce(flight_economy_snapshots.pilot_callsign, ''))
  )
);

-- Blindaje explícito: solo lectura propia en salary, sin insert/update/delete cliente.
drop policy if exists pwg_salary_select_own on public.pilot_salary_ledger;
create policy pwg_salary_select_own
on public.pilot_salary_ledger
for select
to authenticated
using (pilot_id = auth.uid());
