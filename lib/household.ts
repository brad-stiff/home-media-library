import { HouseholdRole } from './types';
import { supabase } from './supabase';

export type HouseholdMembership = {
  householdId: string;
  role: HouseholdRole;
  inviteCode: string;
  name: string;
};

export type HouseholdMember = {
  userId: string;
  role: HouseholdRole;
  displayName: string | null;
  joinedAt: string;
};

export async function getMyHousehold(): Promise<HouseholdMembership> {
  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id, role')
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) {
    throw new Error('No household found for this account. Try signing out and back in.');
  }

  const { data: household, error: householdError } = await supabase
    .from('households')
    .select('id, name, invite_code')
    .eq('id', membership.household_id)
    .single();

  if (householdError) throw householdError;

  return {
    householdId: household.id,
    role: membership.role as HouseholdRole,
    inviteCode: household.invite_code,
    name: household.name,
  };
}

export async function listHouseholdMembers(): Promise<HouseholdMember[]> {
  const household = await getMyHousehold();

  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .eq('household_id', household.householdId)
    .order('joined_at', { ascending: true });

  if (membersError) throw membersError;

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string | null]));

  return (members ?? []).map((m) => ({
    userId: m.user_id,
    role: m.role as HouseholdRole,
    displayName: nameById.get(m.user_id) ?? null,
    joinedAt: m.joined_at,
  }));
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

/** True when Postgres raised our "has movies / force" guard. */
export function isJoinNeedsForceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('force');
}
