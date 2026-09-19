-- Home Media Library — Phase 1 schema
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
  role text not null check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- One household per user (Phase 1 product rule)
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
-- Phase 2 RPCs: rename, rotate invite code, join by code
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