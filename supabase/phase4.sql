-- Home Media Library — Phase 4 (checkout / lending)
-- Run after phase3.sql

create table if not exists public.checkouts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_type text not null check (item_type in ('movie', 'book')),
  item_id uuid not null,
  borrower_name text not null,
  checked_out_at timestamptz not null default now(),
  returned_at timestamptz,
  checked_out_by uuid references auth.users (id) on delete set null,
  notes text,
  constraint checkouts_borrower_name_not_blank check (length(trim(borrower_name)) > 0)
);

-- One active loan per item
create unique index if not exists checkouts_one_active_per_item
  on public.checkouts (household_id, item_type, item_id)
  where returned_at is null;

create index if not exists checkouts_household_active_idx
  on public.checkouts (household_id)
  where returned_at is null;

alter table public.checkouts enable row level security;

drop policy if exists "Members can read household checkouts" on public.checkouts;
create policy "Members can read household checkouts"
  on public.checkouts for select
  using (public.is_household_member(household_id));

drop policy if exists "Members can insert household checkouts" on public.checkouts;
create policy "Members can insert household checkouts"
  on public.checkouts for insert
  with check (
    public.is_household_member(household_id)
    and household_id = public.current_household_id()
    and returned_at is null
  );

drop policy if exists "Members can update household checkouts" on public.checkouts;
create policy "Members can update household checkouts"
  on public.checkouts for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Checkout helper: create active loan (fails if already out)
create or replace function public.checkout_item(
  p_item_type text,
  p_item_id uuid,
  p_borrower_name text,
  p_notes text default null
)
returns public.checkouts
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  row public.checkouts;
  borrower text := trim(p_borrower_name);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if p_item_type not in ('movie', 'book') then
    raise exception 'Invalid item type';
  end if;
  if borrower is null or length(borrower) < 1 then
    raise exception 'Enter a borrower name';
  end if;

  if p_item_type = 'movie' then
    if not exists (
      select 1 from public.movies
      where id = p_item_id and household_id = hid
    ) then
      raise exception 'Movie not found in your household';
    end if;
  else
    if not exists (
      select 1 from public.books
      where id = p_item_id and household_id = hid
    ) then
      raise exception 'Book not found in your household';
    end if;
  end if;

  if exists (
    select 1 from public.checkouts
    where household_id = hid
      and item_type = p_item_type
      and item_id = p_item_id
      and returned_at is null
  ) then
    raise exception 'This item is already checked out';
  end if;

  insert into public.checkouts (
    household_id, item_type, item_id, borrower_name, checked_out_by, notes
  )
  values (hid, p_item_type, p_item_id, borrower, auth.uid(), nullif(trim(p_notes), ''))
  returning * into row;

  return row;
end;
$$;

create or replace function public.return_item(p_checkout_id uuid)
returns public.checkouts
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  row public.checkouts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;

  update public.checkouts
  set returned_at = now()
  where id = p_checkout_id
    and household_id = hid
    and returned_at is null
  returning * into row;

  if row.id is null then
    raise exception 'Active checkout not found';
  end if;

  return row;
end;
$$;

grant execute on function public.checkout_item(text, uuid, text, text) to authenticated;
grant execute on function public.return_item(uuid) to authenticated;
