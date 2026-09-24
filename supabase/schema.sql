-- Home Media Library — full schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Household',
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- One household per user
  unique (user_id)
);

create table public.movies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  tmdb_id integer not null,
  title text not null,
  year text,
  poster_path text,
  backdrop_path text,
  overview text,
  runtime integer,
  genres text[] not null default '{}',
  has_bluray boolean not null default false,
  has_4k boolean not null default false,
  has_digital boolean not null default false,
  platform text,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, tmdb_id),
  constraint movies_has_ownership check (has_bluray or has_4k or has_digital)
);

create index movies_household_title_idx on public.movies (household_id, title);
create index movies_household_tmdb_idx on public.movies (household_id, tmdb_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_household_admin(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Signup: profile + household + admin membership
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
  code text;
  attempts int := 0;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );

  loop
    code := public.generate_invite_code();
    begin
      insert into public.households (name, invite_code, created_by)
      values ('My Household', code, new.id)
      returning id into new_household_id;
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 10 then
        raise exception 'Could not generate unique invite code';
      end if;
    end;
  end loop;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'admin');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists movies_set_updated_at on public.movies;
create trigger movies_set_updated_at
  before update on public.movies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.movies enable row level security;

-- Profiles
create policy "Users can read own or co-member profiles"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members me
      join public.household_members them on them.household_id = me.household_id
      where me.user_id = auth.uid()
        and them.user_id = profiles.id
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Households: members can read their household
create policy "Members can read their household"
  on public.households for select
  using (public.is_household_member(id));

-- Household members: see co-members of your household
create policy "Members can read household membership"
  on public.household_members for select
  using (public.is_household_member(household_id));

-- Movies
create policy "Members can read household movies"
  on public.movies for select
  using (public.is_household_member(household_id));

create policy "Members can insert household movies"
  on public.movies for insert
  with check (
    public.is_household_member(household_id)
    and household_id = public.current_household_id()
  );

create policy "Members can update household movies"
  on public.movies for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Delete is admin-only
create policy "Admins can delete household movies"
  on public.movies for delete
  using (public.is_household_admin(household_id));

-- ---------------------------------------------------------------------------
-- Household RPCs: rename, rotate invite code, join by code
-- ---------------------------------------------------------------------------

create or replace function public.update_household_name(new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
begin
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_admin(hid) then
    raise exception 'Only admins can rename the household';
  end if;
  if length(trim(new_name)) < 1 then
    raise exception 'Household name cannot be empty';
  end if;

  update public.households
  set name = trim(new_name)
  where id = hid;
end;
$$;

create or replace function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  code text;
  attempts int := 0;
begin
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_admin(hid) then
    raise exception 'Only admins can regenerate the invite code';
  end if;

  loop
    code := public.generate_invite_code();
    begin
      update public.households
      set invite_code = code
      where id = hid;
      return code;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 10 then
        raise exception 'Could not generate unique invite code';
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.join_household(p_code text, p_force boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  old_id uuid;
  movie_count int;
  remaining_members int;
  normalized text := upper(trim(p_code));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if normalized is null or length(normalized) < 4 then
    raise exception 'Enter a valid invite code';
  end if;

  select id into target_id
  from public.households
  where invite_code = normalized;

  if target_id is null then
    raise exception 'No household found for that invite code';
  end if;

  select household_id into old_id
  from public.household_members
  where user_id = auth.uid();

  if old_id is not null and old_id = target_id then
    return target_id;
  end if;

  if old_id is not null then
    select count(*) into movie_count
    from public.movies
    where household_id = old_id;

    if movie_count > 0 and not p_force then
      raise exception
        'Your current household has % movie(s). Join with force to abandon them and switch households.',
        movie_count;
    end if;

    delete from public.household_members
    where user_id = auth.uid()
      and household_id = old_id;

    select count(*) into remaining_members
    from public.household_members
    where household_id = old_id;

    if remaining_members = 0 then
      delete from public.households where id = old_id;
    end if;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (target_id, auth.uid(), 'member');

  return target_id;
end;
$$;

grant execute on function public.update_household_name(text) to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.join_household(text, boolean) to authenticated;
-- ---------------------------------------------------------------------------
-- Movie barcode + books
-- ---------------------------------------------------------------------------

alter table public.movies
  add column if not exists barcode text;

create index if not exists movies_household_barcode_idx
  on public.movies (household_id, barcode)
  where barcode is not null;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  isbn text,
  title text not null,
  authors text[] not null default '{}',
  year text,
  cover_url text,
  overview text,
  open_library_key text,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, isbn)
);

create index if not exists books_household_title_idx
  on public.books (household_id, title);

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

alter table public.books enable row level security;

drop policy if exists "Members can read household books" on public.books;
create policy "Members can read household books"
  on public.books for select
  using (public.is_household_member(household_id));

drop policy if exists "Members can insert household books" on public.books;
create policy "Members can insert household books"
  on public.books for insert
  with check (
    public.is_household_member(household_id)
    and household_id = public.current_household_id()
  );

drop policy if exists "Members can update household books" on public.books;
create policy "Members can update household books"
  on public.books for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "Admins can delete household books" on public.books;
create policy "Admins can delete household books"
  on public.books for delete
  using (public.is_household_admin(household_id));

-- ---------------------------------------------------------------------------
-- Checkouts / lending
-- ---------------------------------------------------------------------------

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
-- MTG collection + commander decks

create table if not exists public.mtg_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  scryfall_id uuid not null,
  oracle_id uuid,
  name text not null,
  set_code text,
  set_name text,
  collector_number text,
  mana_cost text,
  type_line text,
  rarity text,
  image_uri text,
  qty integer not null default 1 check (qty > 0),
  foil boolean not null default false,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, scryfall_id, foil)
);

create index if not exists mtg_cards_household_name_idx
  on public.mtg_cards (household_id, name);

create table if not exists public.mtg_decks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  description text,
  archidekt_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mtg_decks_household_idx
  on public.mtg_decks (household_id, name);

create table if not exists public.mtg_deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.mtg_decks (id) on delete cascade,
  scryfall_id uuid not null,
  oracle_id uuid,
  name text not null,
  image_uri text,
  mana_cost text,
  type_line text,
  qty integer not null default 1 check (qty > 0),
  category text not null default 'Deck',
  is_commander boolean not null default false,
  unique (deck_id, scryfall_id, category)
);

create index if not exists mtg_deck_cards_deck_idx
  on public.mtg_deck_cards (deck_id, name);

drop trigger if exists mtg_cards_set_updated_at on public.mtg_cards;
create trigger mtg_cards_set_updated_at
  before update on public.mtg_cards
  for each row execute function public.set_updated_at();

drop trigger if exists mtg_decks_set_updated_at on public.mtg_decks;
create trigger mtg_decks_set_updated_at
  before update on public.mtg_decks
  for each row execute function public.set_updated_at();

alter table public.mtg_cards enable row level security;
alter table public.mtg_decks enable row level security;
alter table public.mtg_deck_cards enable row level security;

-- mtg_cards policies
drop policy if exists "Members can read household mtg cards" on public.mtg_cards;
create policy "Members can read household mtg cards"
  on public.mtg_cards for select
  using (public.is_household_member(household_id));

drop policy if exists "Members can insert household mtg cards" on public.mtg_cards;
create policy "Members can insert household mtg cards"
  on public.mtg_cards for insert
  with check (
    public.is_household_member(household_id)
    and household_id = public.current_household_id()
  );

drop policy if exists "Members can update household mtg cards" on public.mtg_cards;
create policy "Members can update household mtg cards"
  on public.mtg_cards for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "Admins can delete household mtg cards" on public.mtg_cards;
create policy "Admins can delete household mtg cards"
  on public.mtg_cards for delete
  using (public.is_household_admin(household_id));

-- mtg_decks policies
drop policy if exists "Members can read household mtg decks" on public.mtg_decks;
create policy "Members can read household mtg decks"
  on public.mtg_decks for select
  using (public.is_household_member(household_id));

drop policy if exists "Members can insert household mtg decks" on public.mtg_decks;
create policy "Members can insert household mtg decks"
  on public.mtg_decks for insert
  with check (
    public.is_household_member(household_id)
    and household_id = public.current_household_id()
  );

drop policy if exists "Members can update household mtg decks" on public.mtg_decks;
create policy "Members can update household mtg decks"
  on public.mtg_decks for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "Admins can delete household mtg decks" on public.mtg_decks;
create policy "Admins can delete household mtg decks"
  on public.mtg_decks for delete
  using (public.is_household_admin(household_id));

-- mtg_deck_cards: access via parent deck household
drop policy if exists "Members can read deck cards" on public.mtg_deck_cards;
create policy "Members can read deck cards"
  on public.mtg_deck_cards for select
  using (
    exists (
      select 1 from public.mtg_decks d
      where d.id = deck_id and public.is_household_member(d.household_id)
    )
  );

drop policy if exists "Members can insert deck cards" on public.mtg_deck_cards;
create policy "Members can insert deck cards"
  on public.mtg_deck_cards for insert
  with check (
    exists (
      select 1 from public.mtg_decks d
      where d.id = deck_id
        and public.is_household_member(d.household_id)
        and d.household_id = public.current_household_id()
    )
  );

drop policy if exists "Members can update deck cards" on public.mtg_deck_cards;
create policy "Members can update deck cards"
  on public.mtg_deck_cards for update
  using (
    exists (
      select 1 from public.mtg_decks d
      where d.id = deck_id and public.is_household_member(d.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.mtg_decks d
      where d.id = deck_id and public.is_household_member(d.household_id)
    )
  );

drop policy if exists "Admins can delete deck cards" on public.mtg_deck_cards;
create policy "Admins can delete deck cards"
  on public.mtg_deck_cards for delete
  using (
    exists (
      select 1 from public.mtg_decks d
      where d.id = deck_id and public.is_household_admin(d.household_id)
    )
  );

-- Members can also remove cards from decks they manage (edit deck contents)
drop policy if exists "Members can delete deck cards" on public.mtg_deck_cards;
create policy "Members can delete deck cards"
  on public.mtg_deck_cards for delete
  using (
    exists (
      select 1 from public.mtg_decks d
      where d.id = deck_id and public.is_household_member(d.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Phase 6 — roles and household lifecycle
-- Fresh installs run this after the statements above.
-- Existing projects: run from this banner to the end of the file.
-- ---------------------------------------------------------------------------

create or replace function public.is_household_writer(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role in ('admin', 'member')
  );
$$;

create or replace function public.can_edit_deck(target_deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mtg_decks d
    where d.id = target_deck_id
      and (
        public.is_household_admin(d.household_id)
        or (
          public.is_household_writer(d.household_id)
          and d.created_by = auth.uid()
        )
      )
  );
$$;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'household_members'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%role%';

  if constraint_name is not null then
    execute format(
      'alter table public.household_members drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.household_members
  add constraint household_members_role_check
  check (role in ('admin', 'member', 'viewer'));

-- Signup creates a profile only. The app gates on Create or Join.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace function public.protect_row_ownership()
returns trigger
language plpgsql
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id cannot be changed';
  end if;

  if tg_table_name = 'mtg_decks' then
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by cannot be changed';
    end if;
  elsif tg_table_name in ('movies', 'books', 'mtg_cards') then
    if new.added_by is distinct from old.added_by then
      raise exception 'added_by cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists movies_protect_ownership on public.movies;
create trigger movies_protect_ownership
  before update on public.movies
  for each row execute function public.protect_row_ownership();

drop trigger if exists books_protect_ownership on public.books;
create trigger books_protect_ownership
  before update on public.books
  for each row execute function public.protect_row_ownership();

drop trigger if exists mtg_cards_protect_ownership on public.mtg_cards;
create trigger mtg_cards_protect_ownership
  before update on public.mtg_cards
  for each row execute function public.protect_row_ownership();

drop trigger if exists mtg_decks_protect_ownership on public.mtg_decks;
create trigger mtg_decks_protect_ownership
  before update on public.mtg_decks
  for each row execute function public.protect_row_ownership();

-- Invite codes are admin-only. Members and viewers can still read the household.
revoke select (invite_code) on table public.households from public, anon, authenticated;

-- Movies
drop policy if exists "Members can insert household movies" on public.movies;
drop policy if exists "Writers can insert household movies" on public.movies;
create policy "Writers can insert household movies"
  on public.movies for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and added_by = auth.uid()
  );

drop policy if exists "Members can update household movies" on public.movies;
drop policy if exists "Writers can update household movies" on public.movies;
create policy "Writers can update household movies"
  on public.movies for update
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by is not null
      and exists (
        select 1
        from public.household_members owner_member
        where owner_member.household_id = movies.household_id
          and owner_member.user_id = movies.added_by
      )
    )
  )
  with check (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by is not null
      and exists (
        select 1
        from public.household_members owner_member
        where owner_member.household_id = movies.household_id
          and owner_member.user_id = movies.added_by
      )
    )
  );

drop policy if exists "Admins can delete household movies" on public.movies;
drop policy if exists "Admins or owners can delete household movies" on public.movies;
create policy "Admins or owners can delete household movies"
  on public.movies for delete
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by = auth.uid()
    )
  );

-- Books
drop policy if exists "Members can insert household books" on public.books;
drop policy if exists "Writers can insert household books" on public.books;
create policy "Writers can insert household books"
  on public.books for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and added_by = auth.uid()
  );

drop policy if exists "Members can update household books" on public.books;
drop policy if exists "Writers can update household books" on public.books;
create policy "Writers can update household books"
  on public.books for update
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by is not null
      and exists (
        select 1
        from public.household_members owner_member
        where owner_member.household_id = books.household_id
          and owner_member.user_id = books.added_by
      )
    )
  )
  with check (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by is not null
      and exists (
        select 1
        from public.household_members owner_member
        where owner_member.household_id = books.household_id
          and owner_member.user_id = books.added_by
      )
    )
  );

drop policy if exists "Admins can delete household books" on public.books;
drop policy if exists "Admins or owners can delete household books" on public.books;
create policy "Admins or owners can delete household books"
  on public.books for delete
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by = auth.uid()
    )
  );

-- Checkouts: viewers can read, writers can lend and return
drop policy if exists "Members can insert household checkouts" on public.checkouts;
drop policy if exists "Writers can insert household checkouts" on public.checkouts;
create policy "Writers can insert household checkouts"
  on public.checkouts for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and returned_at is null
  );

drop policy if exists "Members can update household checkouts" on public.checkouts;
drop policy if exists "Writers can update household checkouts" on public.checkouts;
create policy "Writers can update household checkouts"
  on public.checkouts for update
  using (public.is_household_writer(household_id))
  with check (public.is_household_writer(household_id));

-- MTG collection
drop policy if exists "Members can insert household mtg cards" on public.mtg_cards;
drop policy if exists "Writers can insert household mtg cards" on public.mtg_cards;
create policy "Writers can insert household mtg cards"
  on public.mtg_cards for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and added_by = auth.uid()
  );

drop policy if exists "Members can update household mtg cards" on public.mtg_cards;
drop policy if exists "Owners can update household mtg cards" on public.mtg_cards;
create policy "Owners can update household mtg cards"
  on public.mtg_cards for update
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by = auth.uid()
    )
  )
  with check (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by = auth.uid()
    )
  );

drop policy if exists "Admins can delete household mtg cards" on public.mtg_cards;
drop policy if exists "Admins or owners can delete household mtg cards" on public.mtg_cards;
create policy "Admins or owners can delete household mtg cards"
  on public.mtg_cards for delete
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by = auth.uid()
    )
  );

-- Decks: create is any writer; edit and delete are creator or admin
drop policy if exists "Members can insert household mtg decks" on public.mtg_decks;
drop policy if exists "Writers can insert household mtg decks" on public.mtg_decks;
create policy "Writers can insert household mtg decks"
  on public.mtg_decks for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and created_by = auth.uid()
  );

drop policy if exists "Members can update household mtg decks" on public.mtg_decks;
drop policy if exists "Deck editors can update household mtg decks" on public.mtg_decks;
create policy "Deck editors can update household mtg decks"
  on public.mtg_decks for update
  using (public.can_edit_deck(id))
  with check (public.can_edit_deck(id));

drop policy if exists "Admins can delete household mtg decks" on public.mtg_decks;
drop policy if exists "Deck editors can delete household mtg decks" on public.mtg_decks;
create policy "Deck editors can delete household mtg decks"
  on public.mtg_decks for delete
  using (public.can_edit_deck(id));

drop policy if exists "Members can insert deck cards" on public.mtg_deck_cards;
drop policy if exists "Deck editors can insert deck cards" on public.mtg_deck_cards;
create policy "Deck editors can insert deck cards"
  on public.mtg_deck_cards for insert
  with check (public.can_edit_deck(deck_id));

drop policy if exists "Members can update deck cards" on public.mtg_deck_cards;
drop policy if exists "Deck editors can update deck cards" on public.mtg_deck_cards;
create policy "Deck editors can update deck cards"
  on public.mtg_deck_cards for update
  using (public.can_edit_deck(deck_id))
  with check (public.can_edit_deck(deck_id));

drop policy if exists "Admins can delete deck cards" on public.mtg_deck_cards;
drop policy if exists "Members can delete deck cards" on public.mtg_deck_cards;
drop policy if exists "Deck editors can delete deck cards" on public.mtg_deck_cards;
create policy "Deck editors can delete deck cards"
  on public.mtg_deck_cards for delete
  using (public.can_edit_deck(deck_id));

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
  if not public.is_household_writer(hid) then
    raise exception 'Viewers cannot check out items';
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
  if not public.is_household_writer(hid) then
    raise exception 'Viewers cannot return items';
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

-- Reassign households.created_by when that person leaves and others remain.
create or replace function public.reassign_created_by(p_household_id uuid, p_leaving_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  next_admin uuid;
begin
  select created_by into owner_id
  from public.households
  where id = p_household_id;

  if owner_id is distinct from p_leaving_user then
    return;
  end if;

  select user_id into next_admin
  from public.household_members
  where household_id = p_household_id
    and user_id <> p_leaving_user
    and role = 'admin'
  order by joined_at asc
  limit 1;

  if next_admin is null then
    raise exception 'Transfer admin to another member before leaving';
  end if;

  update public.households
  set created_by = next_admin
  where id = p_household_id;
end;
$$;

create or replace function public.get_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  code text;
begin
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_admin(hid) then
    raise exception 'Only admins can view the invite code';
  end if;

  select invite_code into code
  from public.households
  where id = hid;

  return code;
end;
$$;

create or replace function public.household_library_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  member_count int;
  admin_count int;
  my_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    return null;
  end if;

  select count(*) into member_count
  from public.household_members
  where household_id = hid;

  select count(*) into admin_count
  from public.household_members
  where household_id = hid
    and role = 'admin';

  select role into my_role
  from public.household_members
  where household_id = hid
    and user_id = auth.uid();

  return jsonb_build_object(
    'householdId', hid,
    'householdName', (select name from public.households where id = hid),
    'movies', (select count(*) from public.movies where household_id = hid),
    'books', (select count(*) from public.books where household_id = hid),
    'mtgCards', (select count(*) from public.mtg_cards where household_id = hid),
    'decks', (select count(*) from public.mtg_decks where household_id = hid),
    'activeCheckouts', (
      select count(*) from public.checkouts
      where household_id = hid and returned_at is null
    ),
    'members', member_count,
    'admins', admin_count,
    'role', my_role,
    'wouldDelete', member_count = 1,
    'isSoleAdmin', my_role = 'admin' and admin_count = 1 and member_count > 1
  );
end;
$$;

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  code text;
  attempts int := 0;
  trimmed text := trim(p_name);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if public.current_household_id() is not null then
    raise exception 'Leave your current household before creating a new one';
  end if;
  if trimmed is null or length(trimmed) < 1 then
    raise exception 'Household name cannot be empty';
  end if;

  loop
    code := public.generate_invite_code();
    begin
      insert into public.households (name, invite_code, created_by)
      values (trimmed, code, auth.uid())
      returning id into new_id;
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 10 then
        raise exception 'Could not generate unique invite code';
      end if;
    end;
  end loop;

  insert into public.household_members (household_id, user_id, role)
  values (new_id, auth.uid(), 'admin');

  return new_id;
end;
$$;

create or replace function public.leave_household(p_acknowledge boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  member_count int;
  admin_count int;
  my_role text;
  remaining int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;

  select count(*) into member_count
  from public.household_members
  where household_id = hid;

  select count(*) into admin_count
  from public.household_members
  where household_id = hid
    and role = 'admin';

  select role into my_role
  from public.household_members
  where household_id = hid
    and user_id = auth.uid();

  if my_role = 'admin' and admin_count = 1 and member_count > 1 then
    raise exception 'Transfer admin to another member before leaving';
  end if;

  if member_count = 1 and not p_acknowledge then
    raise exception 'Confirm this will delete the household';
  end if;

  if member_count > 1 then
    perform public.reassign_created_by(hid, auth.uid());
  end if;

  delete from public.household_members
  where household_id = hid
    and user_id = auth.uid();

  select count(*) into remaining
  from public.household_members
  where household_id = hid;

  if remaining = 0 then
    delete from public.households where id = hid;
  end if;
end;
$$;

create or replace function public.join_household(p_code text, p_force boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  old_id uuid;
  member_count int;
  admin_count int;
  my_role text;
  remaining int;
  normalized text := upper(trim(p_code));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if normalized is null or length(normalized) < 4 then
    raise exception 'Enter a valid invite code';
  end if;

  select id into target_id
  from public.households
  where invite_code = normalized;

  if target_id is null then
    raise exception 'No household found for that invite code';
  end if;

  select household_id into old_id
  from public.household_members
  where user_id = auth.uid();

  if old_id is not null and old_id = target_id then
    raise exception 'You are already in this household';
  end if;

  if old_id is not null then
    select count(*) into member_count
    from public.household_members
    where household_id = old_id;

    select count(*) into admin_count
    from public.household_members
    where household_id = old_id
      and role = 'admin';

    select role into my_role
    from public.household_members
    where household_id = old_id
      and user_id = auth.uid();

    if my_role = 'admin' and admin_count = 1 and member_count > 1 then
      raise exception 'Transfer admin to another member before leaving';
    end if;

    if member_count = 1 and not p_force then
      raise exception 'Confirm this will delete the household';
    end if;

    if member_count > 1 then
      perform public.reassign_created_by(old_id, auth.uid());
    end if;

    delete from public.household_members
    where user_id = auth.uid()
      and household_id = old_id;

    select count(*) into remaining
    from public.household_members
    where household_id = old_id;

    if remaining = 0 then
      delete from public.households where id = old_id;
    end if;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (target_id, auth.uid(), 'viewer');

  return target_id;
end;
$$;

create or replace function public.set_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  admin_count int;
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_admin(hid) then
    raise exception 'Only admins can change roles';
  end if;
  if p_role not in ('admin', 'member', 'viewer') then
    raise exception 'Role must be admin, member, or viewer';
  end if;

  select role into target_role
  from public.household_members
  where household_id = hid
    and user_id = p_user_id;

  if target_role is null then
    raise exception 'That person is not in your household';
  end if;

  if target_role = 'admin' and p_role <> 'admin' then
    select count(*) into admin_count
    from public.household_members
    where household_id = hid
      and role = 'admin';

    if admin_count <= 1 then
      raise exception 'Transfer admin to another member before leaving';
    end if;
  end if;

  update public.household_members
  set role = p_role
  where household_id = hid
    and user_id = p_user_id;
end;
$$;

create or replace function public.remove_household_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  target_role text;
  admin_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_admin(hid) then
    raise exception 'Only admins can remove members';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Use leave to remove yourself';
  end if;

  select role into target_role
  from public.household_members
  where household_id = hid
    and user_id = p_user_id;

  if target_role is null then
    raise exception 'That person is not in your household';
  end if;

  if target_role = 'admin' then
    select count(*) into admin_count
    from public.household_members
    where household_id = hid
      and role = 'admin';

    if admin_count <= 1 then
      raise exception 'Transfer admin to another member before leaving';
    end if;
  end if;

  perform public.reassign_created_by(hid, p_user_id);

  delete from public.household_members
  where household_id = hid
    and user_id = p_user_id;
end;
$$;

revoke all on function public.reassign_created_by(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_invite_code() to authenticated;
grant execute on function public.household_library_summary() to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.leave_household(boolean) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;
