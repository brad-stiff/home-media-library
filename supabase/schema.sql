-- Home Media Library — current schema.
-- Run once in the Supabase SQL Editor for a new project.
-- The live project is already on this schema. Do not run this file there.
--
-- After that baseline, add a file under supabase/migrations and apply it once
-- on the live project. Keep this snapshot in sync with those files so a new
-- project matches the live database.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  appearance text not null default 'system',
  hide_movies boolean not null default false,
  hide_books boolean not null default false,
  hide_mtg boolean not null default false,
  library_view jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint profiles_appearance_check check (appearance in ('system', 'light', 'dark'))
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
  role text not null,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- One household per user
  unique (user_id),
  constraint household_members_role_check check (role in ('admin', 'member', 'viewer'))
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
  barcode text,
  added_by uuid references auth.users (id) on delete set null,
  added_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, tmdb_id),
  constraint movies_has_ownership check (has_bluray or has_4k or has_digital)
);

create index movies_household_title_idx on public.movies (household_id, title);
create index movies_household_tmdb_idx on public.movies (household_id, tmdb_id);
create index movies_household_barcode_idx
  on public.movies (household_id, barcode)
  where barcode is not null;

create table public.books (
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

create index books_household_title_idx on public.books (household_id, title);

create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_type text not null check (item_type in ('movie', 'book')),
  item_id uuid not null,
  contact_id uuid,
  borrower_name text not null,
  checked_out_at timestamptz not null default now(),
  returned_at timestamptz,
  cancelled_at timestamptz,
  checked_out_by uuid references auth.users (id) on delete set null,
  notes text,
  constraint checkouts_borrower_name_not_blank check (length(trim(borrower_name)) > 0),
  constraint checkouts_one_outcome check (returned_at is null or cancelled_at is null)
);

create unique index checkouts_one_active_per_item
  on public.checkouts (household_id, item_type, item_id)
  where returned_at is null and cancelled_at is null;

create index checkouts_household_active_idx
  on public.checkouts (household_id)
  where returned_at is null;

create table public.mtg_cards (
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
  -- Second face for transform and modal double-faced cards. Null when the card has one picture.
  back_image_uri text,
  -- True after Scryfall has been asked, including cards that have no separate back.
  back_resolved boolean not null default false,
  qty integer not null default 1 check (qty > 0),
  foil boolean not null default false,
  color_identity text,
  added_by uuid references auth.users (id) on delete set null,
  added_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, scryfall_id, foil)
);

create index mtg_cards_household_name_idx on public.mtg_cards (household_id, name);

create table public.mtg_decks (
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

create index mtg_decks_household_idx on public.mtg_decks (household_id, name);

create table public.mtg_deck_cards (
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
  constraint mtg_deck_cards_board_check check (board in ('commander', 'main', 'sideboard', 'maybeboard')),
  constraint mtg_deck_cards_deck_id_scryfall_id_board_foil_key unique (deck_id, scryfall_id, board, foil)
);

create index mtg_deck_cards_deck_idx on public.mtg_deck_cards (deck_id, name);

create table public.contacts (
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

create index contacts_household_name_idx on public.contacts (household_id, name);

create unique index contacts_household_email_idx
  on public.contacts (household_id, email)
  where email is not null;

alter table public.checkouts
  add constraint checkouts_contact_id_fkey
  foreign key (contact_id) references public.contacts (id) on delete restrict;

create index checkouts_contact_active_idx
  on public.checkouts (contact_id)
  where contact_id is not null
    and returned_at is null
    and cancelled_at is null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.generate_invite_code()
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

create function public.current_household_id()
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

create function public.is_household_admin(target_household_id uuid)
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

create function public.is_household_member(target_household_id uuid)
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

create function public.is_household_writer(target_household_id uuid)
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

create function public.can_edit_deck(target_deck_id uuid)
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

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Signup creates a profile only. The app gates on Create or Join.
create function public.handle_new_user()
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

-- Ownership ids stay fixed while the account exists. Account delete sets them
-- null and is the only writer of the stamped display name.
create function public.protect_row_ownership()
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger movies_set_updated_at
  before update on public.movies
  for each row execute function public.set_updated_at();

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

create trigger mtg_cards_set_updated_at
  before update on public.mtg_cards
  for each row execute function public.set_updated_at();

create trigger mtg_decks_set_updated_at
  before update on public.mtg_decks
  for each row execute function public.set_updated_at();

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger movies_protect_ownership
  before update on public.movies
  for each row execute function public.protect_row_ownership();

create trigger books_protect_ownership
  before update on public.books
  for each row execute function public.protect_row_ownership();

create trigger mtg_cards_protect_ownership
  before update on public.mtg_cards
  for each row execute function public.protect_row_ownership();

create trigger mtg_decks_protect_ownership
  before update on public.mtg_decks
  for each row execute function public.protect_row_ownership();

-- ---------------------------------------------------------------------------
-- Household lifecycle
-- ---------------------------------------------------------------------------

create function public.update_household_name(new_name text)
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

create function public.regenerate_invite_code()
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

create function public.get_invite_code()
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

-- Reassign households.created_by when that person leaves and others remain.
create function public.reassign_created_by(p_household_id uuid, p_leaving_user uuid)
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

create function public.household_library_summary()
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

create function public.create_household(p_name text)
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

create function public.leave_household(p_acknowledge boolean default false)
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

create function public.join_household(p_code text, p_force boolean default false)
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

create function public.set_member_role(p_user_id uuid, p_role text)
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

create function public.remove_household_member(p_user_id uuid)
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

create function public.set_household_media(
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

create function public.set_household_lending(p_enabled boolean)
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

create function public.delete_own_account()
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

-- ---------------------------------------------------------------------------
-- Contacts and checkout
-- Contacts are people outside the household. Checkout stores a snapshot of
-- the contact name. Email match links an account; it does not join this home.
-- ---------------------------------------------------------------------------

create function public.save_contact(
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

create function public.delete_contact(p_contact_id uuid)
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

create function public.mark_contact_app_invite(p_contact_id uuid)
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

create function public.checkout_item(
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

create function public.return_item(p_checkout_id uuid)
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

create function public.cancel_checkout(p_checkout_id uuid)
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

create function public.update_checkout_borrower(
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

-- item_id points at movies or books, so it cannot be one foreign key.
-- Loan history stays when a title is deleted. New loans must name a title
-- in the same household.
create function public.checkouts_require_catalog_item()
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

create trigger checkouts_require_catalog_item
  before insert or update on public.checkouts
  for each row execute function public.checkouts_require_catalog_item();

-- Any member can fill a blank color identity. Quantity and other columns stay put.
create function public.fill_mtg_color_identities(p_cards jsonb)
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

-- Any member can store a card back. Quantity and other columns stay put.
create function public.fill_mtg_card_backs(p_cards jsonb)
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

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.movies enable row level security;
alter table public.books enable row level security;
alter table public.checkouts enable row level security;
alter table public.mtg_cards enable row level security;
alter table public.mtg_decks enable row level security;
alter table public.mtg_deck_cards enable row level security;
alter table public.contacts enable row level security;

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

create policy "Members can read their household"
  on public.households for select
  using (public.is_household_member(id));

create policy "Members can read household membership"
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy "Members can read household movies"
  on public.movies for select
  using (public.is_household_member(household_id));

create policy "Writers can insert household movies"
  on public.movies for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and added_by = auth.uid()
  );

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

create policy "Admins or owners can delete household movies"
  on public.movies for delete
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by = auth.uid()
    )
  );

create policy "Members can read household books"
  on public.books for select
  using (public.is_household_member(household_id));

create policy "Writers can insert household books"
  on public.books for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and added_by = auth.uid()
  );

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

create policy "Admins or owners can delete household books"
  on public.books for delete
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by = auth.uid()
    )
  );

create policy "Members can read household checkouts"
  on public.checkouts for select
  using (public.is_household_member(household_id));

create policy "Members can read household mtg cards"
  on public.mtg_cards for select
  using (public.is_household_member(household_id));

create policy "Writers can insert household mtg cards"
  on public.mtg_cards for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and added_by = auth.uid()
  );

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

create policy "Admins or owners can delete household mtg cards"
  on public.mtg_cards for delete
  using (
    public.is_household_admin(household_id)
    or (
      public.is_household_writer(household_id)
      and added_by = auth.uid()
    )
  );

create policy "Members can read household mtg decks"
  on public.mtg_decks for select
  using (public.is_household_member(household_id));

create policy "Writers can insert household mtg decks"
  on public.mtg_decks for insert
  with check (
    public.is_household_writer(household_id)
    and household_id = public.current_household_id()
    and created_by = auth.uid()
  );

create policy "Deck editors can update household mtg decks"
  on public.mtg_decks for update
  using (public.can_edit_deck(id))
  with check (public.can_edit_deck(id));

create policy "Deck editors can delete household mtg decks"
  on public.mtg_decks for delete
  using (public.can_edit_deck(id));

create policy "Members can read deck cards"
  on public.mtg_deck_cards for select
  using (
    exists (
      select 1 from public.mtg_decks d
      where d.id = deck_id and public.is_household_member(d.household_id)
    )
  );

create policy "Deck editors can insert deck cards"
  on public.mtg_deck_cards for insert
  with check (public.can_edit_deck(deck_id));

create policy "Deck editors can update deck cards"
  on public.mtg_deck_cards for update
  using (public.can_edit_deck(deck_id))
  with check (public.can_edit_deck(deck_id));

create policy "Deck editors can delete deck cards"
  on public.mtg_deck_cards for delete
  using (public.can_edit_deck(deck_id));

create policy "Members can read household contacts"
  on public.contacts for select
  using (public.is_household_member(household_id));

-- Invite codes are admin-only. Members and viewers can still read the household.
revoke select (invite_code) on table public.households from public, anon, authenticated;

revoke all on function public.reassign_created_by(uuid, uuid) from public, anon, authenticated;

revoke all on function public.set_household_media(boolean, boolean, boolean) from public, anon;
revoke all on function public.set_household_lending(boolean) from public, anon;
revoke all on function public.delete_own_account() from public, anon;
revoke all on function public.save_contact(uuid, text, text, text, boolean) from public, anon;
revoke all on function public.delete_contact(uuid) from public, anon;
revoke all on function public.mark_contact_app_invite(uuid) from public, anon;
revoke all on function public.checkout_item(text, uuid, uuid, text) from public, anon;
revoke all on function public.update_checkout_borrower(uuid, uuid) from public, anon;
revoke all on function public.checkouts_require_catalog_item() from public, anon, authenticated;
revoke all on function public.fill_mtg_color_identities(jsonb) from public, anon;
revoke all on function public.fill_mtg_card_backs(jsonb) from public, anon;

grant execute on function public.update_household_name(text) to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.get_invite_code() to authenticated;
grant execute on function public.household_library_summary() to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.leave_household(boolean) to authenticated;
grant execute on function public.join_household(text, boolean) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;
grant execute on function public.set_household_media(boolean, boolean, boolean) to authenticated;
grant execute on function public.set_household_lending(boolean) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.save_contact(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.delete_contact(uuid) to authenticated;
grant execute on function public.mark_contact_app_invite(uuid) to authenticated;
grant execute on function public.checkout_item(text, uuid, uuid, text) to authenticated;
grant execute on function public.return_item(uuid) to authenticated;
grant execute on function public.cancel_checkout(uuid) to authenticated;
grant execute on function public.update_checkout_borrower(uuid, uuid) to authenticated;
grant execute on function public.fill_mtg_color_identities(jsonb) to authenticated;
grant execute on function public.fill_mtg_card_backs(jsonb) to authenticated;
