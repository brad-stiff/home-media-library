-- Apply once on the live project. supabase/schema.sql already includes this
-- for a new database. Do not run schema.sql on the live project.

alter table public.mtg_cards
  add column if not exists back_image_uri text,
  add column if not exists back_resolved boolean not null default false;

-- Any member can store a card back. Quantity and other columns stay put.
create or replace function public.fill_mtg_card_backs(p_cards jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  updated_count integer := 0;
  entry jsonb;
  card_id uuid;
  back_uri text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_member(hid) then
    raise exception 'Not in this household';
  end if;
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    return 0;
  end if;

  for entry in select value from jsonb_array_elements(p_cards)
  loop
    if not (entry ? 'back_image_uri') then
      continue;
    end if;
    begin
      card_id := nullif(entry->>'id', '')::uuid;
    exception
      when invalid_text_representation then
        continue;
    end;
    if card_id is null then
      continue;
    end if;

    back_uri := nullif(trim(entry->>'back_image_uri'), '');
    if back_uri is not null
      and (
        back_uri !~ '^https://(cards\.scryfall\.io|c1\.scryfall\.com)/'
        or length(back_uri) > 500
      ) then
      continue;
    end if;

    update public.mtg_cards
    set back_image_uri = back_uri,
        back_resolved = true
    where id = card_id
      and household_id = hid
      and back_resolved = false;

    if found then
      updated_count := updated_count + 1;
    end if;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.fill_mtg_card_backs(jsonb) from public, anon;
grant execute on function public.fill_mtg_card_backs(jsonb) to authenticated;
