import { describe, expect, it } from 'vitest';

import { commanderPreconProducts, parsePreconDeck, preconCopyCounts, searchPrecons } from './precons';

const today = '2026-10-11';
const names = new Map([
  ['fic', 'Final Fantasy Commander'],
  ['blc', 'Bloomburrow Commander'],
]);

function entry(patch: Record<string, unknown>) {
  return {
    type: 'Commander Deck',
    fileName: 'CounterBlitzFinalFantasyX_FIC',
    name: 'Counter Blitz (FINAL FANTASY X)',
    code: 'FIC',
    releaseDate: '2025-06-13',
    ...patch,
  };
}

describe('commander precon products', () => {
  const payload = {
    data: [
      entry({}),
      entry({
        fileName: 'LimitBreakFinalFantasyVii_FIC',
        name: 'Limit Break (FINAL FANTASY VII)',
      }),
      entry({
        fileName: 'AnimatedArmy_BLC',
        name: 'Animated Army',
        code: 'blc',
        releaseDate: '2024-08-02',
      }),
      entry({ fileName: 'FutureDeck_FIC', name: 'Future Deck', releaseDate: '2026-12-01' }),
      entry({ type: 'Secret Lair Drop', fileName: 'HatsuneMiku_SLD', name: 'Hatsune Miku', code: 'SLD' }),
      entry({ fileName: 'bad name', name: 'Broken' }),
      entry({ fileName: 'TodayDeck_FIC', name: 'Today Deck', releaseDate: today }),
      entry({ fileName: 'CounterBlitzFinalFantasyX_FIC', name: 'Duplicate' }),
    ],
  };

  it('keeps released commander decks, grouped and sorted with set names', () => {
    const products = commanderPreconProducts(payload, names, today);
    expect(products.map((product) => product.setName)).toEqual([
      'Final Fantasy Commander',
      'Bloomburrow Commander',
    ]);
    expect(products[0]?.decks.map((deck) => deck.name)).toEqual([
      'Counter Blitz (FINAL FANTASY X)',
      'Limit Break (FINAL FANTASY VII)',
      'Today Deck',
    ]);
    expect(products[0]?.setCode).toBe('FIC');
    expect(products[1]?.decks[0]?.setCode).toBe('BLC');
  });

  it('searches deck names and set names', () => {
    const products = commanderPreconProducts(payload, names, today);
    expect(searchPrecons(products, 'limit').map((deck) => deck.fileName)).toEqual([
      'LimitBreakFinalFantasyVii_FIC',
    ]);
    expect(searchPrecons(products, 'bloomburrow').map((deck) => deck.name)).toEqual(['Animated Army']);
    expect(searchPrecons(products, '   ')).toEqual([]);
  });
});

describe('parse precon deck', () => {
  const parsed = parsePreconDeck({
    data: {
      name: ' Counter Blitz ',
      commander: [
        { name: "Tidus, Yuna's Guardian", count: 1, isFoil: true, identifiers: { scryfallId: 'tidus' } },
      ],
      mainBoard: [
        { name: 'Yuna, Grand Summoner', count: 1, isEtched: true, identifiers: { scryfallId: 'yuna' } },
        { name: 'Island', count: 2, identifiers: { scryfallId: 'island' } },
        { name: 'Island', count: 1, identifiers: { scryfallId: 'island' } },
        { name: 'No Id' },
      ],
      displayCommander: [{ name: 'Oversized Tidus', identifiers: { scryfallId: 'display' } }],
      tokens: [{ name: 'Treasure', count: 4, identifiers: { scryfallId: 'treasure' } }],
    },
  });

  it('keeps the playable list, foil finishes, and copy counts', () => {
    expect(parsed.name).toBe('Counter Blitz');
    expect(parsed.missingNames).toEqual(['No Id']);
    expect(parsed.cards).toEqual([
      { name: "Tidus, Yuna's Guardian", scryfallId: 'tidus', qty: 1, foil: true, board: 'commander' },
      { name: 'Yuna, Grand Summoner', scryfallId: 'yuna', qty: 1, foil: true, board: 'main' },
      { name: 'Island', scryfallId: 'island', qty: 3, foil: false, board: 'main' },
    ]);
    expect(preconCopyCounts(parsed.cards)).toEqual({ copies: 5, foils: 2 });
  });
});
