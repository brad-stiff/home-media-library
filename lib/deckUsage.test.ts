import { describe, expect, it } from 'vitest';

import { availableCopies, sumCommittedDeckCopies, type DeckCopyRow } from './deckUsage';

const active = new Set(['deck-a', 'deck-b']);

function row(patch: Partial<DeckCopyRow> & Pick<DeckCopyRow, 'deckId'>): DeckCopyRow {
  return { qty: 1, foil: false, board: 'main', ...patch };
}

describe('sumCommittedDeckCopies', () => {
  it('sums main, commander, and sideboard copies by finish', () => {
    const counts = sumCommittedDeckCopies(
      [
        row({ deckId: 'deck-a', qty: 2 }),
        row({ deckId: 'deck-a', board: 'commander' }),
        row({ deckId: 'deck-b', board: 'sideboard', foil: true, qty: 3 }),
        row({ deckId: 'deck-b', foil: true }),
      ],
      active,
    );
    expect(counts).toEqual({ nonfoil: 3, foil: 4 });
  });

  it('skips the maybeboard and archived decks', () => {
    const counts = sumCommittedDeckCopies(
      [
        row({ deckId: 'deck-a', board: 'maybeboard', qty: 4 }),
        row({ deckId: 'archived', qty: 2, foil: true }),
      ],
      active,
    );
    expect(counts).toEqual({ nonfoil: 0, foil: 0 });
  });
});

describe('availableCopies', () => {
  it('subtracts committed copies from each finish', () => {
    expect(availableCopies({ nonfoil: 4, foil: 1 }, { nonfoil: 1, foil: 1 })).toEqual({ nonfoil: 3, foil: 0 });
  });

  it('stays at zero when decks list more copies than you own', () => {
    expect(availableCopies({ nonfoil: 1, foil: 0 }, { nonfoil: 3, foil: 1 })).toEqual({ nonfoil: 0, foil: 0 });
  });
});
