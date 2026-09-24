import { HouseholdRole } from './types';
import { supabase } from './supabase';

export type HouseholdMembership = {
  householdId: string;
  role: HouseholdRole;
  inviteCode: string | null;
  name: string;
  createdBy: string;
  showMovies: boolean;
  showBooks: boolean;
  showMtg: boolean;
};

export type HouseholdMember = {
  userId: string;
  role: HouseholdRole;
  displayName: string | null;
  joinedAt: string;
};

export type LibrarySummary = {
  householdId: string;
  householdName: string;
  movies: number;
  books: number;
  mtgCards: number;
  decks: number;
  activeCheckouts: number;
  members: number;
  admins: number;
  role: HouseholdRole;
  wouldDelete: boolean;
  isSoleAdmin: boolean;
};

function booleanFlag(row: object, key: string): boolean {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : true;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function isTransferAdminError(error: unknown): boolean {
  return errorMessage(error, '').toLowerCase().includes('transfer admin');
}

export function isConfirmDeleteError(error: unknown): boolean {
  return errorMessage(error, '').toLowerCase().includes('delete the household');
}

export async function fetchMyHousehold(): Promise<HouseholdMembership | null> {
  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id, role')
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  const withMedia = await supabase
    .from('households')
    .select('id, name, created_by, show_movies, show_books, show_mtg')
    .eq('id', membership.household_id)
    .single();

  const householdResult = withMedia.error
    ? await supabase
        .from('households')
        .select('id, name, created_by')
        .eq('id', membership.household_id)
        .single()
    : withMedia;

  const household = householdResult.data;
  if (householdResult.error || !household) throw householdResult.error;

  let inviteCode: string | null = null;
  if (membership.role === 'admin') {
    const { data: code, error: codeError } = await supabase.rpc('get_invite_code');
    if (codeError) throw codeError;
    inviteCode = code as string;
  }

  return {
    householdId: household.id,
    role: membership.role as HouseholdRole,
    inviteCode,
    name: household.name,
    createdBy: household.created_by,
    showMovies: booleanFlag(household, 'show_movies'),
    showBooks: booleanFlag(household, 'show_books'),
    showMtg: booleanFlag(household, 'show_mtg'),
  };
}

export async function setHouseholdMedia(shows: {
  movies: boolean;
  books: boolean;
  mtg: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('set_household_media', {
    p_show_movies: shows.movies,
    p_show_books: shows.books,
    p_show_mtg: shows.mtg,
  });
  if (error) throw error;
}

export async function getMyHousehold(): Promise<HouseholdMembership> {
  const household = await fetchMyHousehold();
  if (!household) {
    throw new Error('Create or join a household before using the library.');
  }
  return household;
}

export async function listHouseholdMembers(): Promise<HouseholdMember[]> {
  const household = await getMyHousehold();

  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .eq('household_id', household.householdId)
    .order('joined_at', { ascending: true });

  if (membersError) throw membersError;

  const userIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name as string | null]),
  );

  return (members ?? []).map((member) => ({
    userId: member.user_id,
    role: member.role as HouseholdRole,
    displayName: nameById.get(member.user_id) ?? null,
    joinedAt: member.joined_at,
  }));
}

export async function getLibrarySummary(): Promise<LibrarySummary | null> {
  const { data, error } = await supabase.rpc('household_library_summary');
  if (error) throw error;
  if (!data) return null;
  return data as LibrarySummary;
}

export async function createHousehold(name: string): Promise<void> {
  const { error } = await supabase.rpc('create_household', { p_name: name.trim() });
  if (error) throw error;
}

export async function updateHouseholdName(name: string): Promise<void> {
  const { error } = await supabase.rpc('update_household_name', { new_name: name });
  if (error) throw error;
}

export async function regenerateInviteCode(): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_invite_code');
  if (error) throw error;
  return data as string;
}

export async function joinHousehold(code: string, force = false): Promise<void> {
  const { error } = await supabase.rpc('join_household', {
    p_code: code.trim().toUpperCase(),
    p_force: force,
  });
  if (error) throw error;
}

export async function leaveHousehold(acknowledge: boolean): Promise<void> {
  const { error } = await supabase.rpc('leave_household', { p_acknowledge: acknowledge });
  if (error) throw error;
}

export async function setMemberRole(userId: string, role: HouseholdRole): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function removeHouseholdMember(userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_household_member', { p_user_id: userId });
  if (error) throw error;
}

export function libraryCountLines(summary: LibrarySummary): string[] {
  const lines = [
    `${summary.movies} ${summary.movies === 1 ? 'movie' : 'movies'}`,
    `${summary.books} ${summary.books === 1 ? 'book' : 'books'}`,
    `${summary.mtgCards} ${summary.mtgCards === 1 ? 'MTG card row' : 'MTG card rows'}`,
    `${summary.decks} ${summary.decks === 1 ? 'deck' : 'decks'}`,
  ];
  if (summary.activeCheckouts > 0) {
    lines.push(
      `${summary.activeCheckouts} active ${summary.activeCheckouts === 1 ? 'checkout' : 'checkouts'} (does not block leaving)`,
    );
  }
  return lines;
}
