import { describe, expect, it } from 'vitest';

import {
  attributionName,
  canDeleteOwned,
  canEditHouseholdFacts,
  isWriter,
  roleHint,
  roleLabel,
} from './roles';

const owner = 'owner-1';
const other = 'other-2';

describe('isWriter', () => {
  it('allows admin and member', () => {
    expect(isWriter('admin')).toBe(true);
    expect(isWriter('member')).toBe(true);
  });

  it('blocks viewers', () => {
    expect(isWriter('viewer')).toBe(false);
  });
});

describe('role labels', () => {
  it('names each role', () => {
    expect(roleLabel('admin')).toBe('Admin');
    expect(roleLabel('member')).toBe('Member');
    expect(roleLabel('viewer')).toBe('Viewer');
  });

  it('describes what each role can do', () => {
    expect(roleHint('admin')).toMatch(/invite code/i);
    expect(roleHint('member')).toMatch(/they added/i);
    expect(roleHint('viewer')).toMatch(/cannot add/i);
  });
});

describe('canDeleteOwned', () => {
  it('lets an admin delete any row, including one with no owner', () => {
    expect(canDeleteOwned('admin', owner, other)).toBe(true);
    expect(canDeleteOwned('admin', null, other)).toBe(true);
  });

  it('lets a member delete only a row they added', () => {
    expect(canDeleteOwned('member', owner, owner)).toBe(true);
    expect(canDeleteOwned('member', owner, other)).toBe(false);
    expect(canDeleteOwned('member', null, owner)).toBe(false);
    expect(canDeleteOwned('member', owner, null)).toBe(false);
  });

  it('blocks viewers even on their own rows', () => {
    expect(canDeleteOwned('viewer', owner, owner)).toBe(false);
  });
});

describe('canEditHouseholdFacts', () => {
  const members = new Set([owner]);

  it('lets an admin edit after the adder has left', () => {
    expect(canEditHouseholdFacts('admin', owner, new Set())).toBe(true);
    expect(canEditHouseholdFacts('admin', null, new Set())).toBe(true);
  });

  it('lets a member edit only while the adder is still in the household', () => {
    expect(canEditHouseholdFacts('member', owner, members)).toBe(true);
    expect(canEditHouseholdFacts('member', owner, new Set())).toBe(false);
    expect(canEditHouseholdFacts('member', null, members)).toBe(false);
  });

  it('blocks viewers', () => {
    expect(canEditHouseholdFacts('viewer', owner, members)).toBe(false);
  });
});

describe('attributionName', () => {
  const members = [{ userId: owner, displayName: 'Ada' }];

  it('uses the member display name', () => {
    expect(attributionName(owner, members)).toBe('Ada');
  });

  it('falls back when the member has no display name', () => {
    expect(attributionName(owner, [{ userId: owner, displayName: '  ' }])).toBe('Member');
    expect(attributionName(owner, [{ userId: owner, displayName: null }])).toBe('Member');
  });

  it('labels someone who left', () => {
    expect(attributionName(owner, [])).toBe('Former member');
  });

  it('labels a deleted account only when a name was stamped', () => {
    expect(attributionName(null, members, 'Ada')).toBe('Deleted account');
    expect(attributionName(null, members, null)).toBeNull();
    expect(attributionName(null, members)).toBeNull();
  });
});
