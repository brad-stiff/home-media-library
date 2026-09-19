-- Home Media Library — Phase 5 (MTG collection + commander decks)
-- Run after phase4.sql

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
