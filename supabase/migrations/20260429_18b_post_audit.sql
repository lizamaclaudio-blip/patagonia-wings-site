-- ================================================================
-- Bloque 18B - Auditoría post implementación
-- Objetivo: validar snapshots actual, crecimiento de ledger/salary y cuadre balance
-- Tipo: solo lectura/auditoría
-- ================================================================

with totals as (
  select 'snapshots_actual' as metric, count(*)::numeric as value
  from public.flight_economy_snapshots
  where economy_source = 'actual'
  union all
  select 'ledger_total', count(*)::numeric
  from public.airline_ledger
  union all
  select 'salary_total', count(*)::numeric
  from public.pilot_salary_ledger
),
ledger_vs_balance as (
  select
    a.id,
    round(coalesce(a.balance_usd, 0)::numeric, 2) as airline_balance,
    round(coalesce(sum(l.amount_usd), 0)::numeric, 2) as ledger_balance,
    round((coalesce(a.balance_usd, 0) - coalesce(sum(l.amount_usd), 0))::numeric, 2) as diff
  from public.airlines a
  left join public.airline_ledger l on l.airline_id = a.id
  group by a.id, a.balance_usd
)
select * from totals
union all
select
  concat('balance_check_', id::text) as metric,
  case when diff = 0 then 1 else 0 end::numeric as value
from ledger_vs_balance
order by metric;

-- Esperado tras prueba finalize ACARS:
-- snapshots_actual > 0
-- ledger_total > 1
-- salary_total > 0
-- balance_check_* = 1
