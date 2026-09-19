-- Home Media Library — Phase 3
-- Run after phase2.sql (or use full schema.sql on a fresh project).

-- Optional barcode on movies (UPC/EAN from scan)
alter table public.movies
  add column if not exists barcode text;

create index if not exists movies_household_barcode_idx
  on public.movies (household_id, barcode)
  where barcode is not null;

-- Books catalog (ISBN / Open Library)
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
