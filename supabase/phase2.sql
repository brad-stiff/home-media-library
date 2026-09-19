-- Home Media Library — Phase 2 (run if you already applied schema.sql from Phase 1)
-- Safe to re-run: uses drop/create for functions and create policy if missing patterns.

-- Allow reading co-member profiles (for member list display names)
drop policy if exists "Users can read own profile" on public.profiles;
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

-- Admins can rename their household
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

-- Admins can rotate the invite code
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

-- Join another household by short invite code (one household per user).
-- If your current household has movies, pass p_force := true to abandon them.
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
