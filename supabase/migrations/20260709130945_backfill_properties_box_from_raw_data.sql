with consistent_box as (
  select
    l.property_id,
    min(l.raw_data->'property'->'location'->'address'->>'box') as box
  from listings l
  where l.raw_data->'property'->'location'->'address'->>'box' is not null
  group by l.property_id
  having count(distinct l.raw_data->'property'->'location'->'address'->>'box') = 1
)
update properties p
set box = cb.box
from consistent_box cb
where p.id = cb.property_id
  and p.box is null;