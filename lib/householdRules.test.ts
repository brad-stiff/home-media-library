import { describe, expect, it } from 'vitest';

import {
  errorMessage,
  isConfirmDeleteError,
  isInviteCodeReady,
  isTransferAdminError,
  libraryCountLines,
  normalizeInviteCode,
  type LibrarySummary,
} from './householdRules';

function summary(overrides: Partial<LibrarySummary> = {}): LibrarySummary {
  return {
    householdId: 'home',
    householdName: 'Home',
    movies: 0,
    books: 0,
    mtgCards: 0,
    decks: 0,
    activeCheckouts: 0,
    members: 1,
    admins: 1,
    role: 'admin',
    wouldDelete: true,
    isSoleAdmin: true,
    ...overrides,
  };
}

describe('invite codes', () => {
  it('trims and uppercases the way join_household does', () => {
    expect(normalizeInviteCode('  ab12cd  ')).toBe('AB12CD');
  });

  it('is ready only at 4 or more characters after normalization', () => {
    expect(isInviteCodeReady(' abc ')).toBe(false);
    expect(isInviteCodeReady(' abcd ')).toBe(true);
    expect(isInviteCodeReady('')).toBe(false);
  });
});

describe('join and leave errors', () => {
  it('reads an Error message and otherwise uses the fallback', () => {
    expect(errorMessage(new Error('No household found'), 'fallback')).toBe('No household found');
    expect(errorMessage(new Error(''), 'fallback')).toBe('fallback');
    expect(errorMessage('nope', 'fallback')).toBe('fallback');
  });

  it('recognizes the last-admin transfer error', () => {
    expect(isTransferAdminError(new Error('Transfer admin to another member before leaving'))).toBe(
      true,
    );
    expect(isTransferAdminError(new Error('TRANSFER ADMIN'))).toBe(true);
    expect(isTransferAdminError(new Error('No household found'))).toBe(false);
  });

  it('recognizes the dissolve confirmation error', () => {
    expect(isConfirmDeleteError(new Error('Confirm this will delete the household'))).toBe(true);
    expect(isConfirmDeleteError(new Error('confirm this will DELETE THE HOUSEHOLD'))).toBe(true);
    expect(isConfirmDeleteError(new Error('Transfer admin to another member'))).toBe(false);
  });
});

describe('libraryCountLines', () => {
  it('pluralizes each catalog count', () => {
    expect(libraryCountLines(summary({ movies: 1, books: 2, mtgCards: 1, decks: 0 }))).toEqual([
      '1 movie',
      '2 books',
      '1 MTG card row',
      '0 decks',
    ]);
  });

  it('mentions active checkouts without treating them as a block', () => {
    const lines = libraryCountLines(summary({ activeCheckouts: 1 }));
    expect(lines.at(-1)).toBe('1 active checkout (does not block leaving)');
  });

  it('omits the checkout line when nothing is lent', () => {
    expect(libraryCountLines(summary()).some((line) => line.includes('checkout'))).toBe(false);
  });
});
