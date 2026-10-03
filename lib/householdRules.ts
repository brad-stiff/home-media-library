import { HouseholdRole } from './types';

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

/** Matches join_household: upper(trim(code)). */
export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Server rejects codes shorter than 4 characters after trim and uppercase. */
export function isInviteCodeReady(code: string): boolean {
  return normalizeInviteCode(code).length >= 4;
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
