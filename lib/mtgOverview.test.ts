import { describe, expect, it } from 'vitest';

import {
  cardInSet,
  cardMatchesQuery,
  chartTypesForTypeLine,
  collectionCopyTotal,
  collectionTypeBars,
  filterSetSummaries,
  checklistSize,
  inPrintedSet,
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

describe('chartTypesForTypeLine', () => {
  it('keeps each type on a multi-type card and skips supertypes', () => {
    expect(chartTypesForTypeLine('Legendary Artifact Creature — Golem')).toEqual(['Creature', 'Artifact']);
    expect(chartTypesForTypeLine('Basic Land — Forest')).toEqual(['Land']);
    expect(chartTypesForTypeLine('Token Creature — Goblin')).toEqual(['Creature']);
  });

  it('puts uncommon types in Other and reads both faces', () => {
    expect(chartTypesForTypeLine('Battle — Siege')).toEqual(['Other']);
    expect(chartTypesForTypeLine('Kindred Sorcery')).toEqual(['Sorcery', 'Other']);
    expect(chartTypesForTypeLine('Instant // Sorcery')).toEqual(['Instant', 'Sorcery']);
    expect(chartTypesForTypeLine(null)).toEqual(['Other']);
  });
});

describe('collectionTypeBars', () => {
  it('counts a printing once across foil and non-foil, and a multi-type card in each bar', () => {
    const cards = [
      card({ scryfallId: 'a', collectorNumber: '1', typeLine: 'Artifact Creature — Golem', qty: 4 }),
      card({ scryfallId: 'a-foil', collectorNumber: '1', typeLine: 'Artifact Creature — Golem', qty: 2 }),
      card({ scryfallId: 'c', collectorNumber: '2', typeLine: 'Instant', qty: 1 }),
    ];
    expect(collectionTypeBars(cards)).toEqual([
      { type: 'Creature', count: 1 },
      { type: 'Instant', count: 1 },
      { type: 'Artifact', count: 1 },
    ]);
    expect(collectionCopyTotal(cards)).toBe(7);
  });

  it('counts two printings of the same name separately', () => {
    const bars = collectionTypeBars([
      card({ scryfallId: 'a', setCode: 'lea', collectorNumber: '161', typeLine: 'Instant' }),
      card({ scryfallId: 'b', setCode: 'm10', collectorNumber: '146', typeLine: 'Instant' }),
    ]);
    expect(bars).toEqual([{ type: 'Instant', count: 2 }]);
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
