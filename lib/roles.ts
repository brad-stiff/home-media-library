import { HouseholdRole } from './types';

export function isWriter(role: HouseholdRole): boolean {
  return role === 'admin' || role === 'member';
}

export function roleLabel(role: HouseholdRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'member') return 'Member';
  return 'Viewer';
}

export function roleHint(role: HouseholdRole): string {
  if (role === 'admin') {
    return 'Admins manage the invite code, roles, and can remove any item.';
  }
  if (role === 'member') {
    return 'Members can add and edit. They can remove only items they added.';
  }
  return 'Viewers can browse. They cannot add, edit, lend, or delete.';
}

/** Delete or change qty: admin, or the member who added the row. */
export function canDeleteOwned(
  role: HouseholdRole,
  ownerId: string | null,
  userId: string | null,
): boolean {
  if (role === 'admin') return true;
  return role === 'member' && ownerId != null && ownerId === userId;
}

/**
 * Household facts (formats, metadata refresh) while the person who added the
 * row is still a member. After they leave, only an admin may edit the row.
 */
export function canEditHouseholdFacts(
  role: HouseholdRole,
  ownerId: string | null,
  memberIds: ReadonlySet<string>,
): boolean {
  if (role === 'admin') return true;
  if (role !== 'member' || ownerId == null) return false;
  return memberIds.has(ownerId);
}

export function attributionName(
  ownerId: string | null,
  members: { userId: string; displayName: string | null }[],
): string | null {
  if (!ownerId) return null;
  const member = members.find((entry) => entry.userId === ownerId);
  if (!member) return 'Former member';
  return member.displayName?.trim() || 'Member';
}
