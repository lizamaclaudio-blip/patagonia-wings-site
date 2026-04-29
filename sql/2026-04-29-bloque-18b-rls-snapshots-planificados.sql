-- ================================================================
-- Patagonia Wings Web · Bloque 18B
-- RLS mínimo para snapshots planificados desde la web
-- No modifica datos existentes.
-- No abre airline_ledger ni pilot_salary_ledger para escritura cliente.
-- ================================================================

-- Contexto de auditoría:
-- - flight_economy_snapshots está con RLS activo y sin policies.
-- - El cierre ACARS debe escribir snapshots/ledger/sueldos con service role server-side.
-- - El despacho web todavía puede necesitar guardar snapshot planificado SimBrief desde cliente.
-- - Esta policy permite al piloto leer/crear/actualizar/borrar SOLO sus snapshots propios.

alter table public.flight_economy_snapshots enable row level security;

-- Limpieza idempotente de políticas de este bloque.
drop policy if exists pwg_snapshots_select_own on public.flight_economy_snapshots;
drop policy if exists pwg_snapshots_insert_own on public.flight_economy_snapshots;
drop policy if exists pwg_snapshots_update_own on public.flight_economy_snapshots;
drop policy if exists pwg_snapshots_delete_own on public.flight_economy_snapshots;

-- Lectura propia: por pilot_id o por callsign del perfil autenticado.
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

-- Inserción propia: el cliente solo puede crear snapshots asociados a su usuario/callsign.
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

-- Actualización propia.
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

-- Borrado propio, usado por el flujo actual antes de reinsertar snapshot SimBrief.
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

-- Verificación rápida.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'flight_economy_snapshots'
order by policyname;
