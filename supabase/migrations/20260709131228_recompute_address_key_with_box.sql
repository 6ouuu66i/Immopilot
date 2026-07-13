update properties
set address_key = array_to_string(
  array_remove(
    array[
      regexp_replace(regexp_replace(lower(unaccent(replace(street, '''', ''))), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'),
      regexp_replace(regexp_replace(lower(unaccent(replace(house_number, '''', ''))), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'),
      regexp_replace(regexp_replace(lower(unaccent(replace(postal_code, '''', ''))), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'),
      regexp_replace(regexp_replace(lower(unaccent(replace(box, '''', ''))), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g')
    ],
    null
  ),
  '-'
)
where box is not null
  and street is not null and house_number is not null and postal_code is not null;