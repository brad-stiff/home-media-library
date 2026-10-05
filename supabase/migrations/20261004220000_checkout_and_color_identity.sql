-- Apply once on the live project. supabase/schema.sql already includes this
-- for a new database. Do not run schema.sql on the live project.

-- item_id points at movies or books, so it cannot be one foreign key.
-- Loan history stays when a title is deleted (the app shows "Removed item").
-- New and changed loans still have to name a title in the same household.
create or replace function public.checkouts_require_catalog_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.item_id is not distinct from old.item_id
     and new.item_type is not distinct from old.item_type
     and new.household_id is not distinct from old.household_id
  then
    return new;
  end if;

  if new.item_type = 'movie' then
    if not exists (
      select 1 from public.movies
      where id = new.item_id and household_id = new.household_id
    ) then
      raise exception 'Movie not found in your household';
    end if;
  elsif new.item_type = 'book' then
    if not exists (
      select 1 from public.books
      where id = new.item_id and household_id = new.household_id
    ) then
      raise exception 'Book not found in your household';
    end if;
  else
    raise exception 'Invalid item type';
  end if;

  return new;
end;
$$;

drop trigger if exists checkouts_require_catalog_item on public.checkouts;
create trigger checkouts_require_catalog_item
  before insert or update on public.checkouts
  for each row execute function public.checkouts_require_catalog_item();

revoke all on function public.checkouts_require_catalog_item() from public, anon, authenticated;

-- Writes go through checkout_item, return_item, cancel_checkout, and
-- update_checkout_borrower. Members can still read loans.
drop policy if exists "Writers can insert household checkouts" on public.checkouts;
drop policy if exists "Writers can update household checkouts" on public.checkouts;

-- Any member can fill a blank color identity. The function does not change
-- quantity or any other column, and it does not overwrite a value already stored.
create or replace function public.fill_mtg_color_identities(p_cards jsonb)
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
  identity text;
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
    begin
      card_id := nullif(entry->>'id', '')::uuid;
    exception
      when invalid_text_representation then
        continue;
    end;
    if card_id is null or entry->>'color_identity' is null then
      continue;
    end if;
    identity := trim(entry->>'color_identity');
    if identity !~ '^[WUBRG]*$' or length(identity) > 5 then
      continue;
    end if;

    update public.mtg_cards
    set color_identity = identity
    where id = card_id
      and household_id = hid
      and color_identity is null;

    if found then
      updated_count := updated_count + 1;
    end if;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.fill_mtg_color_identities(jsonb) from public, anon;
grant execute on function public.fill_mtg_color_identities(jsonb) to authenticated;
