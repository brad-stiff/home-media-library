import { describe, expect, it } from 'vitest';

import {
  cardInSet,
  cardMatchesQuery,
  collectionColorCounts,
  collectionCopyTotal,
  collectionPrintingTotal,
  printingMatchesColor,
  filterSetSummaries,
  checklistSize,
  inPrintedSet,
  mergePrintedChecklist,
  selectPrintedSlots,
  sortByCollectorNumber,
  summarizeSets,
  type OverviewCard,
  type SetCatalogEntry,
} from './mtgOverview';

function card(partial: Partial<OverviewCard> & Pick<OverviewCard, 'scryfallId'>): OverviewCard {
  return {
    name: 'Card',
    setCode: 'eoe',
    setName: 'Edge of Eternities',
    collectorNumber: '1',
    typeLine: 'Creature — Human',
    qty: 1,
    ...partial,
  };
}

describe('collection totals', () => {
  it('sums copies and collapses foil with non-foil into one printing', () => {
    const cards = [
      card({ scryfallId: 'a', collectorNumber: '1', qty: 4 }),
      card({ scryfallId: 'a-foil', collectorNumber: '1', qty: 2 }),
      card({ scryfallId: 'c', collectorNumber: '2', qty: 1 }),
    ];
    expect(collectionCopyTotal(cards)).toBe(7);
    expect(collectionPrintingTotal(cards)).toBe(2);
  });
});

describe('collectionColorCounts', () => {
  it('counts a multicolor printing in each color and a colorless printing once', () => {
    expect(
      collectionColorCounts([
        { ...card({ scryfallId: 'a', collectorNumber: '1', qty: 4 }), colorIdentity: 'WU' },
        { ...card({ scryfallId: 'a-foil', collectorNumber: '1', qty: 2 }), colorIdentity: 'WU' },
        { ...card({ scryfallId: 'b', collectorNumber: '2' }), colorIdentity: '' },
        { ...card({ scryfallId: 'c', collectorNumber: '3' }), colorIdentity: null },
      ]),
    ).toEqual([
      { color: 'W', count: 1 },
      { color: 'U', count: 1 },
      { color: 'B', count: 0 },
      { color: 'R', count: 0 },
      { color: 'G', count: 0 },
      { color: 'C', count: 1 },
    ]);
  });

  it('counts two printings of the same color separately and hides colorless at zero', () => {
    expect(
      collectionColorCounts([
        { ...card({ scryfallId: 'a', setCode: 'lea', collectorNumber: '161' }), colorIdentity: 'R' },
        { ...card({ scryfallId: 'b', setCode: 'm10', collectorNumber: '146' }), colorIdentity: 'R' },
      ]),
    ).toEqual([
      { color: 'W', count: 0 },
      { color: 'U', count: 0 },
      { color: 'B', count: 0 },
      { color: 'R', count: 2 },
      { color: 'G', count: 0 },
    ]);
  });

  it('waits until Scryfall has resolved an identity', () => {
    expect(collectionColorCounts([{ ...card({ scryfallId: 'a' }), colorIdentity: null }])).toBeNull();
  });

  it('keeps the header count equal to the printings that match that color', () => {
    const cards = [
      { ...card({ scryfallId: 'a', collectorNumber: '1', qty: 4 }), colorIdentity: 'WU' },
      { ...card({ scryfallId: 'a-foil', collectorNumber: '1', qty: 2 }), colorIdentity: 'WU' },
      { ...card({ scryfallId: 'b', collectorNumber: '2' }), colorIdentity: '' },
      { ...card({ scryfallId: 'c', collectorNumber: '3' }), colorIdentity: null },
    ];
    const counts = collectionColorCounts(cards);
    expect(counts).not.toBeNull();
    for (const entry of counts ?? []) {
      const matched = new Set(
        cards.filter((item) => printingMatchesColor(item.colorIdentity, entry.color)).map((item) => `${item.setCode}:${item.collectorNumber}`),
      );
      expect(matched.size).toBe(entry.count);
    }
  });

  it('matches each color a printing contains, and colorless only when it has none', () => {
    expect(printingMatchesColor('WU', 'W')).toBe(true);
    expect(printingMatchesColor('WU', 'U')).toBe(true);
    expect(printingMatchesColor('WU', 'B')).toBe(false);
    expect(printingMatchesColor('WU', 'C')).toBe(false);
    expect(printingMatchesColor('', 'C')).toBe(true);
    expect(printingMatchesColor('', 'W')).toBe(false);
    expect(printingMatchesColor(null, 'C')).toBe(false);
    expect(printingMatchesColor(null, 'R')).toBe(false);
  });
});

describe('printed set completion', () => {
  const catalog = new Map<string, SetCatalogEntry>([
    ['eoe', { name: 'Edge of Eternities', releasedAt: '2025-08-01', printedSize: 286, cardCount: 400, iconSvgUri: 'https://example/eoe.svg' }],
    ['stx', { name: 'Strixhaven', releasedAt: '2021-04-23', printedSize: 275, cardCount: 380, iconSvgUri: null }],
    ['fin', { name: 'Final Fantasy', releasedAt: '2025-06-13', printedSize: null, cardCount: 594, iconSvgUri: null }],
    ['sld', { name: 'Secret Lair', releasedAt: '2019-12-01', printedSize: null, cardCount: null, iconSvgUri: null }],
  ]);

  it('counts a suffix inside the printed size and leaves bonus sheets out', () => {
    expect(inPrintedSet('127a', 286)).toBe(true);
    expect(inPrintedSet('0127', 286)).toBe(true);
    expect(inPrintedSet('A-12', 275)).toBe(false);
    expect(inPrintedSet('300', 286)).toBe(false);
    expect(inPrintedSet('10', null)).toBe(false);
  });

  it('collapses foil and non-foil and ignores numbers outside the printed set', () => {
    const sets = summarizeSets(
      [
        card({ scryfallId: 'a', collectorNumber: '1', qty: 4 }),
        card({ scryfallId: 'a-foil', collectorNumber: '1', qty: 1 }),
        card({ scryfallId: 'b', collectorNumber: '127a' }),
        card({ scryfallId: 'c', collectorNumber: '300' }),
        card({ scryfallId: 'd', setCode: 'stx', setName: 'Strixhaven', collectorNumber: 'A-12' }),
        card({ scryfallId: 'e', setCode: 'stx', setName: 'Strixhaven', collectorNumber: '1' }),
        card({ scryfallId: 'f', setCode: 'sld', setName: 'Secret Lair Drop', collectorNumber: '1' }),
        card({ scryfallId: 'g', setCode: 'sld', setName: 'Secret Lair Drop', collectorNumber: '1' }),
        card({ scryfallId: 'h', setCode: 'fin', setName: 'Final Fantasy', collectorNumber: '12' }),
        card({ scryfallId: 'i', setCode: 'fin', setName: 'Final Fantasy', collectorNumber: '400' }),
      ],
      catalog,
    );

    expect(checklistSize(catalog.get('eoe'))).toBe(286);
    expect(checklistSize(catalog.get('fin'))).toBe(594);
    expect(checklistSize(catalog.get('sld'))).toBeNull();
    const eoe = sets.find((set) => set.code === 'eoe');
    expect(eoe).toMatchObject({ completed: 2, printedSize: 286, percent: 1, owned: 3 });
    const stx = sets.find((set) => set.code === 'stx');
    expect(stx).toMatchObject({ completed: 1, printedSize: 275, owned: 2 });
    const fin = sets.find((set) => set.code === 'fin');
    expect(fin).toMatchObject({ completed: 2, printedSize: 594, percent: 0, owned: 2 });
    const sld = sets.find((set) => set.code === 'sld');
    expect(sld).toMatchObject({ completed: null, printedSize: null, percent: null, owned: 1 });
    expect(sets.map((set) => set.code)).toEqual(['eoe', 'fin', 'stx', 'sld']);
  });

  it('filters tiles by set name and set code', () => {
    const sets = summarizeSets(
      [
        card({ scryfallId: 'a', setCode: 'eoe' }),
        card({ scryfallId: 'b', setCode: 'stx', setName: 'Strixhaven' }),
      ],
      catalog,
    );
    expect(filterSetSummaries(sets, 'EOE').map((set) => set.code)).toEqual(['eoe']);
    expect(filterSetSummaries(sets, 'strix').map((set) => set.code)).toEqual(['stx']);
  });
});

describe('card browse helpers', () => {
  it('matches the collection haystack and a single set', () => {
    const bolt = card({
      scryfallId: 'bolt',
      name: 'Lightning Bolt',
      setCode: 'lea',
      setName: 'Limited Edition Alpha',
      typeLine: 'Instant',
    });
    expect(cardMatchesQuery(bolt, 'bolt')).toBe(true);
    expect(cardMatchesQuery(bolt, 'lea')).toBe(true);
    expect(cardMatchesQuery(bolt, 'forest')).toBe(false);
    expect(cardInSet(bolt, 'lea')).toBe(true);
    expect(cardInSet(bolt, 'eoe')).toBe(false);
    expect(cardInSet(card({ scryfallId: 'x', name: 'Nameless', setCode: '  ' }), '__unknown__')).toBe(true);
  });
});

describe('sortByCollectorNumber', () => {
  function printing(name: string, collectorNumber: string | null, foil = false) {
    return { name, collectorNumber, foil };
  }

  it('orders a set like a checklist', () => {
    const cards = [
      printing('Missing', null),
      printing('Archive ten', 'A-10'),
      printing('Archive', 'A-1'),
      printing('Ten B', '10b'),
      printing('Ten', '10'),
      printing('Ten A foil', '10a', true),
      printing('Ten A', '10a'),
      printing('Nine', '009'),
      printing('Hundred', '100'),
      printing('Bonus later', 'B-2'),
      printing('Blank', '   '),
    ];

    expect(sortByCollectorNumber(cards).map((card) => card.name)).toEqual([
      'Nine',
      'Ten',
      'Ten A',
      'Ten A foil',
      'Ten B',
      'Hundred',
      'Archive',
      'Archive ten',
      'Bonus later',
      'Blank',
      'Missing',
    ]);
  });
});

describe('mergePrintedChecklist', () => {
  function owned(name: string, collectorNumber: string | null, foil = false, scryfallId?: string) {
    return { name, collectorNumber, foil, scryfallId: scryfallId ?? `${name}:${foil ? 'foil' : 'nonfoil'}` };
  }

  function entryName(entry: ReturnType<typeof mergePrintedChecklist<ReturnType<typeof owned>>>[number]): string {
    if (entry.kind === 'missing') return entry.slot.name;
    if (entry.kind === 'printing') return entry.nonfoil?.name ?? entry.foil?.name ?? '';
    return entry.card.name;
  }

  function slot(scryfallId: string, name: string, collectorNumber: string, imageUri: string | null = 'https://img') {
    return { scryfallId, name, collectorNumber, imageUri, backImageUri: null, setCode: 'eoe' };
  }

  it('keeps one base printing and prefers the exact collector number', () => {
    expect(
      selectPrintedSlots(
        [
          slot('padded', 'Padded', '010', 'https://padded'),
          slot('exact', 'Exact', '10', null),
          slot('variant', 'Variant', '10a', 'https://variant'),
          slot('bonus', 'Bonus', 'A-1'),
        ],
        12,
      ).map((card) => card.scryfallId),
    ).toEqual(['exact']);
  });

  it('fills owned numbers and leaves the rest as missing slots', () => {
    const cards = [
      owned('Bolt', '2', true, 'bolt'),
      owned('Bolt', '2', false, 'bolt'),
      owned('Variant', '3a'),
      owned('Archive', 'A-1'),
      owned('Beyond', '20'),
    ];
    const slots = [slot('s1', 'One', '1'), slot('s2', 'Bolt', '2'), slot('s3', 'Three', '3'), slot('s4', 'Four', '4')];
    const entries = mergePrintedChecklist(cards, slots, 12);

    expect(entries.map(entryName)).toEqual(['One', 'Bolt', 'Three', 'Variant', 'Four', 'Beyond', 'Archive']);
    const bolt = entries[1];
    expect(bolt?.kind).toBe('printing');
    if (bolt?.kind === 'printing') {
      expect(bolt.nonfoil?.foil).toBe(false);
      expect(bolt.foil?.foil).toBe(true);
    }
  });

  it('treats a foil-only copy as owning the printed slot', () => {
    const entries = mergePrintedChecklist([owned('Bolt', '2', true, 'bolt')], [slot('s2', 'Bolt', '2')], 12);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('printing');
    if (entries[0]?.kind === 'printing') {
      expect(entries[0].nonfoil).toBeNull();
      expect(entries[0].foil?.foil).toBe(true);
    }
  });

  it('leaves owned printings in place until the checklist arrives', () => {
    const cards = [owned('Bolt', '2'), owned('One', '1')];
    expect(mergePrintedChecklist(cards, null, 12).map(entryName)).toEqual(['Bolt', 'One']);
  });

  it('treats a padded collector number as owning that slot', () => {
    const entries = mergePrintedChecklist([owned('Ten', '010')], [slot('s10', 'Other', '10')], 12);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('printing');
  });
});
