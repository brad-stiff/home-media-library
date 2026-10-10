export type FinishCounts = {
  nonfoil: number;
  foil: number;
};

export type DeckCopyRow = {
  deckId: string;
  qty: number;
  foil: boolean;
  board: string;
};

/**
 * Copies of one printing that are actually in a deck.
 * Maybeboard rows are cards under consideration, and archived decks are not built.
 */
export function sumCommittedDeckCopies(rows: readonly DeckCopyRow[], activeDeckIds: ReadonlySet<string>): FinishCounts {
  const counts: FinishCounts = { nonfoil: 0, foil: 0 };
  for (const row of rows) {
    if (row.board === 'maybeboard' || !activeDeckIds.has(row.deckId)) continue;
    counts[row.foil ? 'foil' : 'nonfoil'] += row.qty;
  }
  return counts;
}

/** Copies still on the shelf. A finish cannot go below zero when decks list more than you own. */
export function availableCopies(owned: FinishCounts, inDecks: FinishCounts): FinishCounts {
  return {
    nonfoil: Math.max(0, owned.nonfoil - inDecks.nonfoil),
    foil: Math.max(0, owned.foil - inDecks.foil),
  };
}
