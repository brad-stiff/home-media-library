-- Home Media Library — full schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  appearance text not null default 'system' check (appearance in ('system', 'light', 'dark')),
  hide_movies boolean not null default false,
  hide_books boolean not null default false,
  hide_mtg boolean not null default false,
  library_view jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Household',
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  show_movies boolean not null default true,
  show_books boolean not null default true,
  show_mtg boolean not null default true,
  lending_enabled boolean not null default true,
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
  added_by_name text,
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
  added_by_name text,
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
  color_identity text,
  added_by uuid references auth.users (id) on delete set null,
  added_by_name text,
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
  format text not null default 'commander',
  archidekt_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mtg_decks_format_check check (format in ('commander', 'standard'))
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
  category text not null default 'Main',
  is_commander boolean not null default false,
  board text not null default 'main',
  foil boolean not null default false,
  color_identity text,
  oracle_text text,
  keywords text[] not null default '{}',
  standard_legality text,
  unique (deck_id, scryfall_id, board, foil),
  constraint mtg_deck_cards_board_check check (board in ('commander', 'main', 'sideboard', 'maybeboard'))
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

-- ---------------------------------------------------------------------------
-- Phase 7 — lending rules and loan history
-- Fresh installs run this after the statements above.
-- Existing projects: run from this banner to the end of the file.
-- ---------------------------------------------------------------------------

alter table public.checkouts
  add column if not exists cancelled_at timestamptz;

alter table public.checkouts drop constraint if exists checkouts_one_outcome;
alter table public.checkouts
  add constraint checkouts_one_outcome
  check (returned_at is null or cancelled_at is null);

drop index if exists public.checkouts_one_active_per_item;
create unique index checkouts_one_active_per_item
  on public.checkouts (household_id, item_type, item_id)
  where returned_at is null and cancelled_at is null;

drop policy if exists "Writers can insert household checkouts" on public.checkouts;
create policy "Writers can insert household checkouts"
  on public.checkouts for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and returned_at is null
    and cancelled_at is null
  );

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
  movie_bluray boolean;
  movie_4k boolean;
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
    select has_bluray, has_4k into movie_bluray, movie_4k
    from public.movies
    where id = p_item_id and household_id = hid;

    if movie_bluray is null then
      raise exception 'Movie not found in your household';
    end if;
    if not movie_bluray and not movie_4k then
      raise exception 'Digital-only movies cannot be checked out';
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
      and cancelled_at is null
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
    and cancelled_at is null
  returning * into row;

  if row.id is null then
    raise exception 'Active checkout not found';
  end if;

  return row;
end;
$$;

create or replace function public.cancel_checkout(p_checkout_id uuid)
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
    raise exception 'Viewers cannot cancel loans';
  end if;

  update public.checkouts
  set cancelled_at = now()
  where id = p_checkout_id
    and household_id = hid
    and returned_at is null
    and cancelled_at is null
  returning * into row;

  if row.id is null then
    raise exception 'Active checkout not found';
  end if;

  return row;
end;
$$;

create or replace function public.update_checkout_borrower(
  p_checkout_id uuid,
  p_borrower_name text
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
    raise exception 'Viewers cannot change a loan';
  end if;
  if borrower is null or length(borrower) < 1 then
    raise exception 'Enter a borrower name';
  end if;

  update public.checkouts
  set borrower_name = borrower
  where id = p_checkout_id
    and household_id = hid
    and returned_at is null
    and cancelled_at is null
  returning * into row;

  if row.id is null then
    raise exception 'Active checkout not found';
  end if;

  return row;
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
      where household_id = hid
        and returned_at is null
        and cancelled_at is null
    ),
    'members', member_count,
    'admins', admin_count,
    'role', my_role,
    'wouldDelete', member_count = 1,
    'isSoleAdmin', my_role = 'admin' and admin_count = 1 and member_count > 1
  );
end;
$$;

grant execute on function public.cancel_checkout(uuid) to authenticated;
grant execute on function public.update_checkout_borrower(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Phase 8 — profile, appearance, media visibility, account delete
-- Safe to run on a database that already has Phases 1–7.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists appearance text not null default 'system';

alter table public.profiles
  add column if not exists hide_movies boolean not null default false;

alter table public.profiles
  add column if not exists hide_books boolean not null default false;

alter table public.profiles
  add column if not exists hide_mtg boolean not null default false;

alter table public.profiles drop constraint if exists profiles_appearance_check;
alter table public.profiles
  add constraint profiles_appearance_check
  check (appearance in ('system', 'light', 'dark'));

alter table public.households
  add column if not exists show_movies boolean not null default true;

alter table public.households
  add column if not exists show_books boolean not null default true;

alter table public.households
  add column if not exists show_mtg boolean not null default true;

alter table public.movies
  add column if not exists added_by_name text;

alter table public.books
  add column if not exists added_by_name text;

alter table public.mtg_cards
  add column if not exists added_by_name text;

alter table public.mtg_decks
  add column if not exists created_by_name text;

-- Ownership ids stay fixed while the account exists. Account delete sets them
-- null and is the only writer of the stamped display name.
create or replace function public.protect_row_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id cannot be changed';
  end if;

  if tg_table_name = 'mtg_decks' then
    if new.created_by is distinct from old.created_by then
      if new.created_by is not null
        or exists (select 1 from auth.users where id = old.created_by) then
        raise exception 'created_by cannot be changed';
      end if;
    end if;
    if new.created_by_name is distinct from old.created_by_name
      and current_setting('app.stamp_owner_name', true) is distinct from '1' then
      raise exception 'created_by_name cannot be changed';
    end if;
  elsif tg_table_name in ('movies', 'books', 'mtg_cards') then
    if new.added_by is distinct from old.added_by then
      if new.added_by is not null
        or exists (select 1 from auth.users where id = old.added_by) then
        raise exception 'added_by cannot be changed';
      end if;
    end if;
    if new.added_by_name is distinct from old.added_by_name
      and current_setting('app.stamp_owner_name', true) is distinct from '1' then
      raise exception 'added_by_name cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.set_household_media(
  p_show_movies boolean,
  p_show_books boolean,
  p_show_mtg boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_admin(hid) then
    raise exception 'Only admins can change which media types the household uses';
  end if;

  update public.households
  set
    show_movies = p_show_movies,
    show_books = p_show_books,
    show_mtg = p_show_mtg
  where id = hid;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stamped text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'Leave your household before deleting your account';
  end if;

  if exists (select 1 from public.households where created_by = uid) then
    raise exception 'Leave your household before deleting your account';
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Deleted account')
  into stamped
  from public.profiles
  where id = uid;

  stamped := coalesce(stamped, 'Deleted account');

  perform set_config('app.stamp_owner_name', '1', true);

  update public.movies
  set added_by_name = stamped
  where added_by = uid;

  update public.books
  set added_by_name = stamped
  where added_by = uid;

  update public.mtg_cards
  set added_by_name = stamped
  where added_by = uid;

  update public.mtg_decks
  set created_by_name = stamped
  where created_by = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.set_household_media(boolean, boolean, boolean) from public, anon;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.set_household_media(boolean, boolean, boolean) to authenticated;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Phase 10 — per-user library view
-- Safe to run on a database that already has Phases 1–9.
-- library_view stores opening tab, dock order, density, and per-tab layout,
-- sort, and availability. The app ignores types that are still hidden.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists library_view jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Phase 11 — deck format, boards, and collection color
-- Safe to run on a database that already has Phases 1–10.
-- Deck lists stay separate from collection qty. Foil is its own row.
-- ---------------------------------------------------------------------------

alter table public.mtg_cards
  add column if not exists color_identity text;

alter table public.mtg_decks
  add column if not exists format text not null default 'commander';

alter table public.mtg_decks drop constraint if exists mtg_decks_format_check;
alter table public.mtg_decks
  add constraint mtg_decks_format_check
  check (format in ('commander', 'standard'));

alter table public.mtg_deck_cards
  add column if not exists board text;

alter table public.mtg_deck_cards
  add column if not exists foil boolean not null default false;

alter table public.mtg_deck_cards
  add column if not exists color_identity text;

alter table public.mtg_deck_cards
  add column if not exists oracle_text text;

alter table public.mtg_deck_cards
  add column if not exists keywords text[] not null default '{}';

alter table public.mtg_deck_cards
  add column if not exists standard_legality text;

update public.mtg_deck_cards
set board = case
  when is_commander or lower(category) = 'commander' then 'commander'
  when lower(category) in ('sideboard', 'side') then 'sideboard'
  when lower(category) in ('maybeboard', 'maybe') then 'maybeboard'
  else 'main'
end
where board is null;

alter table public.mtg_deck_cards
  alter column board set default 'main';

alter table public.mtg_deck_cards
  alter column board set not null;

alter table public.mtg_deck_cards drop constraint if exists mtg_deck_cards_board_check;
alter table public.mtg_deck_cards
  add constraint mtg_deck_cards_board_check
  check (board in ('commander', 'main', 'sideboard', 'maybeboard'));

update public.mtg_deck_cards
set
  is_commander = (board = 'commander'),
  category = case board
    when 'commander' then 'Commander'
    when 'sideboard' then 'Sideboard'
    when 'maybeboard' then 'Maybeboard'
    else 'Main'
  end
where is_commander is distinct from (board = 'commander')
   or category is distinct from case board
    when 'commander' then 'Commander'
    when 'sideboard' then 'Sideboard'
    when 'maybeboard' then 'Maybeboard'
    else 'Main'
  end;

-- One row per printing, board, and foil. Combine leftovers from the old category key.
do $$
declare
  rec record;
begin
  for rec in
    select
      deck_id,
      scryfall_id,
      board,
      foil,
      (array_agg(id))[1] as keep_id,
      sum(qty)::int as total
    from public.mtg_deck_cards
    group by deck_id, scryfall_id, board, foil
    having count(*) > 1
  loop
    update public.mtg_deck_cards
    set qty = rec.total
    where id = rec.keep_id;

    delete from public.mtg_deck_cards
    where deck_id = rec.deck_id
      and scryfall_id = rec.scryfall_id
      and board = rec.board
      and foil = rec.foil
      and id <> rec.keep_id;
  end loop;
end $$;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'mtg_deck_cards'
      and con.contype = 'u'
  loop
    execute format('alter table public.mtg_deck_cards drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.mtg_deck_cards
  add constraint mtg_deck_cards_deck_id_scryfall_id_board_foil_key
  unique (deck_id, scryfall_id, board, foil);

-- ---------------------------------------------------------------------------
-- Phase 12 — lending contacts and household checkout visibility
-- Safe to run on a database that already has Phases 1–11.
-- Existing projects: run from this banner to the end of the file.
-- Contacts are people outside the household. Checkout stores a snapshot of
-- the contact name. Email match links an account; it does not join this home.
-- ---------------------------------------------------------------------------

alter table public.households
  add column if not exists lending_enabled boolean not null default true;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  sms_reminders boolean not null default false,
  linked_user_id uuid references auth.users (id) on delete set null,
  app_invited_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_name_not_blank check (length(trim(name)) > 0),
  constraint contacts_sms_needs_phone check (
    sms_reminders = false
    or (phone is not null and length(trim(phone)) > 0)
  )
);

create index if not exists contacts_household_name_idx
  on public.contacts (household_id, name);

create unique index if not exists contacts_household_email_idx
  on public.contacts (household_id, email)
  where email is not null;

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;

drop policy if exists "Members can read household contacts" on public.contacts;
create policy "Members can read household contacts"
  on public.contacts for select
  using (public.is_household_member(household_id));

alter table public.checkouts
  add column if not exists contact_id uuid references public.contacts (id) on delete restrict;

create index if not exists checkouts_contact_active_idx
  on public.checkouts (contact_id)
  where contact_id is not null
    and returned_at is null
    and cancelled_at is null;

create or replace function public.set_household_lending(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_admin(hid) then
    raise exception 'Only admins can change checkout for the household';
  end if;

  update public.households
  set lending_enabled = p_enabled
  where id = hid;
end;
$$;

create or replace function public.save_contact(
  p_contact_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_sms_reminders boolean
)
returns public.contacts
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  v_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_sms boolean := coalesce(p_sms_reminders, false);
  linked uuid;
  row public.contacts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_writer(hid) then
    raise exception 'Viewers cannot edit contacts';
  end if;
  if v_name is null or length(v_name) < 1 then
    raise exception 'Enter a contact name';
  end if;
  if length(v_name) > 80 then
    raise exception 'Contact name is too long';
  end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email or leave it blank';
  end if;
  if v_email is not null and length(v_email) > 254 then
    raise exception 'Email is too long';
  end if;
  if v_phone is not null and length(v_phone) > 40 then
    raise exception 'Phone number is too long';
  end if;
  if v_phone is null then
    v_sms := false;
  end if;

  if v_email is not null then
    select id into linked
    from auth.users
    where lower(email) = v_email
    limit 1;

    if linked is not null and exists (
      select 1
      from public.household_members
      where household_id = hid
        and user_id = linked
    ) then
      raise exception 'That email belongs to someone in this household. Contacts are people outside the home.';
    end if;

    if exists (
      select 1
      from public.contacts
      where household_id = hid
        and email = v_email
        and id is distinct from p_contact_id
    ) then
      raise exception 'A contact with that email already exists';
    end if;
  end if;

  if p_contact_id is null then
    insert into public.contacts (
      household_id, name, email, phone, sms_reminders, linked_user_id, created_by
    )
    values (hid, v_name, v_email, v_phone, v_sms, linked, auth.uid())
    returning * into row;
  else
    update public.contacts
    set
      name = v_name,
      email = v_email,
      phone = v_phone,
      sms_reminders = v_sms,
      linked_user_id = linked
    where id = p_contact_id
      and household_id = hid
    returning * into row;

    if row is null then
      raise exception 'Contact not found';
    end if;
  end if;

  return row;
end;
$$;

create or replace function public.delete_contact(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_writer(hid) then
    raise exception 'Viewers cannot delete contacts';
  end if;
  if not exists (
    select 1
    from public.contacts
    where id = p_contact_id
      and household_id = hid
  ) then
    raise exception 'Contact not found';
  end if;
  if exists (
    select 1
    from public.checkouts
    where contact_id = p_contact_id
      and returned_at is null
      and cancelled_at is null
  ) then
    raise exception 'Return or cancel active loans for this contact before deleting them';
  end if;

  update public.checkouts
  set contact_id = null
  where contact_id = p_contact_id
    and household_id = hid;

  delete from public.contacts
  where id = p_contact_id
    and household_id = hid;
end;
$$;

create or replace function public.mark_contact_app_invite(p_contact_id uuid)
returns public.contacts
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  row public.contacts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_writer(hid) then
    raise exception 'Viewers cannot invite contacts';
  end if;

  update public.contacts
  set app_invited_at = now()
  where id = p_contact_id
    and household_id = hid
    and email is not null
  returning * into row;

  if row is null then
    raise exception 'Add an email before inviting them to create an account';
  end if;

  return row;
end;
$$;

drop function if exists public.checkout_item(text, uuid, text, text);

create or replace function public.checkout_item(
  p_item_type text,
  p_item_id uuid,
  p_contact_id uuid,
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
  contact public.contacts;
  borrower text;
  movie_bluray boolean;
  movie_4k boolean;
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
  if coalesce((select lending_enabled from public.households where id = hid), true) = false then
    raise exception 'Checkout is turned off for this household';
  end if;
  if p_item_type not in ('movie', 'book') then
    raise exception 'Invalid item type';
  end if;

  select * into contact
  from public.contacts
  where id = p_contact_id
    and household_id = hid;

  if contact is null then
    raise exception 'Choose a contact';
  end if;
  if contact.linked_user_id is not null and exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = contact.linked_user_id
  ) then
    raise exception 'That contact is in this household. Lending is for people outside the home.';
  end if;

  borrower := trim(contact.name);

  if p_item_type = 'movie' then
    select has_bluray, has_4k into movie_bluray, movie_4k
    from public.movies
    where id = p_item_id and household_id = hid;

    if movie_bluray is null then
      raise exception 'Movie not found in your household';
    end if;
    if not movie_bluray and not movie_4k then
      raise exception 'Digital-only movies cannot be checked out';
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
      and cancelled_at is null
  ) then
    raise exception 'This item is already checked out';
  end if;

  insert into public.checkouts (
    household_id, item_type, item_id, contact_id, borrower_name, checked_out_by, notes
  )
  values (
    hid,
    p_item_type,
    p_item_id,
    contact.id,
    borrower,
    auth.uid(),
    nullif(trim(p_notes), '')
  )
  returning * into row;

  return row;
end;
$$;

drop function if exists public.update_checkout_borrower(uuid, text);

create or replace function public.update_checkout_borrower(
  p_checkout_id uuid,
  p_contact_id uuid
)
returns public.checkouts
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  row public.checkouts;
  contact public.contacts;
  borrower text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if hid is null then
    raise exception 'You are not in a household';
  end if;
  if not public.is_household_writer(hid) then
    raise exception 'Viewers cannot change a loan';
  end if;
  if coalesce((select lending_enabled from public.households where id = hid), true) = false then
    raise exception 'Checkout is turned off for this household';
  end if;

  select * into contact
  from public.contacts
  where id = p_contact_id
    and household_id = hid;

  if contact is null then
    raise exception 'Choose a contact';
  end if;
  if contact.linked_user_id is not null and exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = contact.linked_user_id
  ) then
    raise exception 'That contact is in this household. Lending is for people outside the home.';
  end if;

  borrower := trim(contact.name);

  update public.checkouts
  set
    contact_id = contact.id,
    borrower_name = borrower
  where id = p_checkout_id
    and household_id = hid
    and returned_at is null
    and cancelled_at is null
  returning * into row;

  if row.id is null then
    raise exception 'Active checkout not found';
  end if;

  return row;
end;
$$;

revoke all on function public.set_household_lending(boolean) from public, anon;
revoke all on function public.save_contact(uuid, text, text, text, boolean) from public, anon;
revoke all on function public.delete_contact(uuid) from public, anon;
revoke all on function public.mark_contact_app_invite(uuid) from public, anon;
revoke all on function public.checkout_item(text, uuid, uuid, text) from public, anon;
revoke all on function public.update_checkout_borrower(uuid, uuid) from public, anon;

grant execute on function public.set_household_lending(boolean) to authenticated;
grant execute on function public.save_contact(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.delete_contact(uuid) to authenticated;
grant execute on function public.mark_contact_app_invite(uuid) to authenticated;
grant execute on function public.checkout_item(text, uuid, uuid, text) to authenticated;
grant execute on function public.update_checkout_borrower(uuid, uuid) to authenticated;
