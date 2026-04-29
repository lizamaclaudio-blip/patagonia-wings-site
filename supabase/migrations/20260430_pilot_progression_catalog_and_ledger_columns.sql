-- Bloque: Fase 8 - Economia progresion piloto
-- Objetivo: completar catalogo minimo de progresion y asegurar columnas de trazabilidad en pilot_expense_ledger.
-- Tipo: estructura + datos

alter table if exists public.pilot_expense_ledger
  add column if not exists balance_before_usd numeric,
  add column if not exists balance_after_usd numeric,
  add column if not exists status text,
  add column if not exists reference_code text,
  add column if not exists metadata jsonb default '{}'::jsonb;

create unique index if not exists idx_pilot_expense_catalog_code_unique
  on public.pilot_expense_catalog (code);

insert into public.pilot_expense_catalog (code, category, label, amount_usd, is_active, metadata)
select v.code, v.category, v.label, v.amount_usd, true, v.metadata
from (
  values
    ('THEORY_VFR_BASIC','theory_exam','Teórico VFR básico',90,jsonb_build_object('phase','Teórico','required_for','VFR básico')),
    ('THEORY_IFR_INSTRUMENTAL','theory_exam','Teórico IFR / Instrumental',180,jsonb_build_object('phase','Teórico','required_for','IFR')),
    ('THEORY_MULTI_ENGINE','theory_exam','Teórico multimotor',240,jsonb_build_object('phase','Teórico','required_for','Multimotor')),
    ('THEORY_REGIONAL','theory_exam','Teórico regional',320,jsonb_build_object('phase','Teórico','required_for','Regional')),
    ('THEORY_NARROWBODY','theory_exam','Teórico narrowbody',780,jsonb_build_object('phase','Teórico','required_for','Narrowbody')),
    ('THEORY_WIDEBODY','theory_exam','Teórico widebody',1250,jsonb_build_object('phase','Teórico','required_for','Widebody')),
    ('THEORY_RECURRENT','theory_exam','Teórico recurrente',95,jsonb_build_object('phase','Teórico','required_for','Recurrente')),
    ('CHECKRIDE_SINGLE_ENGINE','practical_check','Checkride monomotor',420,jsonb_build_object('phase','Checkride','required_for','Monomotor')),
    ('CHECKRIDE_MULTI_ENGINE','practical_check','Checkride multimotor',880,jsonb_build_object('phase','Checkride','required_for','Multimotor')),
    ('CHECKRIDE_REGIONAL','practical_check','Checkride regional',1300,jsonb_build_object('phase','Checkride','required_for','Regional')),
    ('CHECKRIDE_JET','practical_check','Checkride jet',2600,jsonb_build_object('phase','Checkride','required_for','Jet')),
    ('CHECKRIDE_LONG_HAUL','practical_check','Checkride long haul',4300,jsonb_build_object('phase','Checkride','required_for','Long haul')),
    ('RATING_INSTRUMENTAL','license','Habilitación instrumental',1600,jsonb_build_object('phase','Habilitación','required_for','IFR')),
    ('RATING_CAT_I','license','Habilitación CAT I',450,jsonb_build_object('phase','Habilitación','required_for','CAT I')),
    ('RATING_CAT_II','license','Habilitación CAT II',900,jsonb_build_object('phase','Habilitación','required_for','CAT II')),
    ('RATING_CROSSWIND','license','Habilitación viento cruzado',700,jsonb_build_object('phase','Habilitación','required_for','Crosswind')),
    ('RATING_PATAGONIA_MOUNTAIN','license','Habilitación montaña Patagonia',980,jsonb_build_object('phase','Habilitación','required_for','Montaña')),
    ('CERT_C172','certification','Certificación C172',350,jsonb_build_object('phase','Certificación','required_for','C172')),
    ('CERT_BE58','certification','Certificación BE58',560,jsonb_build_object('phase','Certificación','required_for','BE58')),
    ('CERT_C208','certification','Certificación C208',690,jsonb_build_object('phase','Certificación','required_for','C208')),
    ('CERT_B350','certification','Certificación B350',1400,jsonb_build_object('phase','Certificación','required_for','B350')),
    ('CERT_ATR','certification','Certificación ATR',2400,jsonb_build_object('phase','Certificación','required_for','ATR')),
    ('CERT_A320','certification','Certificación A320',5200,jsonb_build_object('phase','Certificación','required_for','A320')),
    ('CERT_B737','certification','Certificación B737',5400,jsonb_build_object('phase','Certificación','required_for','B737')),
    ('CERT_B787','certification','Certificación B787',9800,jsonb_build_object('phase','Certificación','required_for','B787')),
    ('LICENSE_RECURRENT_ANNUAL','license','Licencia recurrente anual',280,jsonb_build_object('phase','Licencia','required_for','Anual')),
    ('RATING_RENEWAL','license','Renovación habilitación',340,jsonb_build_object('phase','Licencia','required_for','Renovación')),
    ('PRACTICAL_TRAINING','training','Entrenamiento práctico',520,jsonb_build_object('phase','Entrenamiento','required_for','Práctico')),
    ('AIRCRAFT_TRANSITION_COURSE','training','Curso transición aeronave',1150,jsonb_build_object('phase','Entrenamiento','required_for','Transición')),
    ('RANK_PROMOTION_EXAM','training','Examen ascenso de rango',1600,jsonb_build_object('phase','Ascenso','required_for','Rango'))
) as v(code, category, label, amount_usd, metadata)
on conflict (code) do update
set
  category = excluded.category,
  label = excluded.label,
  amount_usd = excluded.amount_usd,
  is_active = true,
  metadata = coalesce(public.pilot_expense_catalog.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();
