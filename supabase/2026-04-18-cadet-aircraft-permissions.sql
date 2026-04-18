-- Patagonia Wings - Cadet aircraft visibility hotfix
-- Backup SQL for Supabase

insert into pilot_rank_aircraft_permissions (rank_code, aircraft_type_code)
select distinct p.rank_code, 'C208'
from pilot_rank_aircraft_permissions p
where p.aircraft_type_code in ('C208_MSFS', 'C208_BLACKSQUARE')
  and not exists (
    select 1
    from pilot_rank_aircraft_permissions x
    where x.rank_code = p.rank_code
      and x.aircraft_type_code = 'C208'
  );

insert into pilot_rank_aircraft_permissions (rank_code, aircraft_type_code)
select distinct p.rank_code, 'BE58'
from pilot_rank_aircraft_permissions p
where p.aircraft_type_code in ('BE58_MSFS', 'BE58_BLACKSQUARE', 'BE58_BS_PRO')
  and not exists (
    select 1
    from pilot_rank_aircraft_permissions x
    where x.rank_code = p.rank_code
      and x.aircraft_type_code = 'BE58'
  );

insert into pilot_rank_aircraft_permissions (rank_code, aircraft_type_code)
select distinct p.rank_code, 'B350'
from pilot_rank_aircraft_permissions p
where p.aircraft_type_code in ('B350_MSFS', 'B350_BLACKSQUARE')
  and not exists (
    select 1
    from pilot_rank_aircraft_permissions x
    where x.rank_code = p.rank_code
      and x.aircraft_type_code = 'B350'
  );
