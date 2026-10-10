-- Apply once on the live project. supabase/schema.sql already includes this
-- for a new database. Do not run schema.sql on the live project.

alter table public.mtg_decks
  add column if not exists sleeve_id text,
  add column if not exists sleeve_image_url text,
  add column if not exists archived_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mtg_decks_sleeve_id_check'
  ) then
    alter table public.mtg_decks
      add constraint mtg_decks_sleeve_id_check
      check (sleeve_id is null or sleeve_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'mtg_decks_sleeve_image_url_check'
  ) then
    alter table public.mtg_decks
      add constraint mtg_decks_sleeve_image_url_check
      check (
        sleeve_image_url is null
        or (
          char_length(sleeve_image_url) <= 500
          and sleeve_image_url ~ '^https://[^[:space:]]+/storage/v1/object/public/deck-sleeves/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\?t=[0-9]+$'
        )
      );
  end if;
end $$;

-- Sleeve photos live in a public bucket. The object name is
-- {household_id}/{deck_id}. Writes are limited to people who can edit that deck.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deck-sleeves',
  'deck-sleeves',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_write_deck_sleeve(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folders text[];
  hid uuid;
  deck uuid;
begin
  folders := storage.foldername(object_name);
  if folders is null or array_length(folders, 1) is distinct from 1 then
    return false;
  end if;
  begin
    hid := folders[1]::uuid;
    deck := storage.filename(object_name)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;
  return exists (
    select 1
    from public.mtg_decks d
    where d.id = deck
      and d.household_id = hid
      and public.can_edit_deck(d.id)
  );
end;
$$;

revoke all on function public.can_write_deck_sleeve(text) from public, anon;
grant execute on function public.can_write_deck_sleeve(text) to authenticated;

drop policy if exists "Deck editors can add sleeve photos" on storage.objects;
create policy "Deck editors can add sleeve photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'deck-sleeves'
    and public.can_write_deck_sleeve(name)
  );

drop policy if exists "Deck editors can replace sleeve photos" on storage.objects;
create policy "Deck editors can replace sleeve photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'deck-sleeves'
    and public.can_write_deck_sleeve(name)
  )
  with check (
    bucket_id = 'deck-sleeves'
    and public.can_write_deck_sleeve(name)
  );

drop policy if exists "Deck editors can remove sleeve photos" on storage.objects;
create policy "Deck editors can remove sleeve photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'deck-sleeves'
    and public.can_write_deck_sleeve(name)
  );
