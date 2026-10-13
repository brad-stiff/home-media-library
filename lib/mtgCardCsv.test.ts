import { describe, expect, it } from 'vitest';

import { MtgCard } from './mtgCards';
import { mtgCardsToCsv } from './mtgCardCsv';

function card(partial: Partial<MtgCard> & Pick<MtgCard, 'id' | 'name'>): MtgCard {
  return {
    householdId: 'house',
    scryfallId: partial.id,
    oracleId: null,
    setCode: 'mh3',
    setName: 'Modern Horizons 3',
    collectorNumber: '1',
    manaCost: '{W}',
    typeLine: 'Creature — Human',
    rarity: 'rare',
    imageUri: null,
    backImageUri: null,
    backResolved: false,
    qty: 1,
    foil: false,
    colorIdentity: 'W',
    addedBy: null,
    addedByName: null,
    addedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('mtgCardsToCsv', () => {
  it('writes a header and one row per printing, foil after nonfoil', () => {
    const csv = mtgCardsToCsv([
      card({ id: 'foil', name: 'Solitude', collectorNumber: '10', foil: true, qty: 2 }),
      card({ id: 'plain', name: 'Solitude', collectorNumber: '10', qty: 4 }),
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1)).toBe(
      [
        'Name,Set,Set code,Collector number,Finish,Quantity,Rarity,Mana cost,Type,Color identity',
        'Solitude,Modern Horizons 3,mh3,10,Nonfoil,4,rare,{W},Creature — Human,W',
        'Solitude,Modern Horizons 3,mh3,10,Foil,2,rare,{W},Creature — Human,W',
        '',
      ].join('\r\n'),
    );
  });

  it('sorts by name, then set, then collector number', () => {
    const csv = mtgCardsToCsv([
      card({ id: 'b', name: 'Birds of Paradise', setCode: 'm12', setName: 'Magic 2012', collectorNumber: '165' }),
      card({ id: 'a', name: 'Birds of Paradise', setCode: '7ed', setName: 'Seventh Edition', collectorNumber: '231' }),
      card({ id: 'c', name: 'Abrade', collectorNumber: '110' }),
    ]);
    const names = csv
      .slice(1)
      .trim()
      .split('\r\n')
      .slice(1)
      .map((line) => line.split(',').slice(0, 4).join(','));

    expect(names).toEqual([
      'Abrade,Modern Horizons 3,mh3,110',
      'Birds of Paradise,Seventh Edition,7ed,231',
      'Birds of Paradise,Magic 2012,m12,165',
    ]);
  });

  it('quotes fields that contain commas or quotes', () => {
    const csv = mtgCardsToCsv([
      card({
        id: 'q',
        name: 'Heaton, "Ace"',
        setName: 'Un, Set',
        typeLine: 'Creature — "Advisor"',
      }),
    ]);
    const line = csv.slice(1).trim().split('\r\n')[1];
    expect(line).toContain('"Heaton, ""Ace"""');
    expect(line).toContain('"Un, Set"');
    expect(line).toContain('"Creature — ""Advisor"""');
  });

  it('keeps a header when the collection is empty', () => {
    expect(mtgCardsToCsv([]).slice(1)).toBe(
      'Name,Set,Set code,Collector number,Finish,Quantity,Rarity,Mana cost,Type,Color identity\r\n',
    );
  });
});
