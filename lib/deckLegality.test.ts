import { describe, expect, it } from 'vitest';

import { deckTileIdentity, deckWarnings, type DeckBoard, type LegalityCard } from './deckLegality';

function card(patch: Partial<LegalityCard> & Pick<LegalityCard, 'name'>): LegalityCard {
  return {
    qty: 1,
    board: 'main',
    typeLine: 'Creature',
    oracleText: '',
    keywords: [],
    colorIdentity: '',
    standardLegality: 'legal',
    ...patch,
  };
}

function fill(name: string, count: number, board: DeckBoard = 'main', patch: Partial<LegalityCard> = {}): LegalityCard[] {
  return Array.from({ length: count }, (_, index) =>
    card({ name: `${name} ${index}`, board, ...patch }),
  );
}

describe('Commander legality', () => {
  const commander = card({
    name: 'Atraxa',
    board: 'commander',
    typeLine: 'Legendary Creature — Phyrexian Angel',
    colorIdentity: 'WUBG',
  });

  it('warns unless the commander plus main deck is 100, and ignores the maybeboard', () => {
    const short = [commander, ...fill('Card', 98)];
    expect(deckWarnings('commander', short).some((warning) => warning.includes('has 99'))).toBe(true);

    const withMaybe = [
      commander,
      ...fill('Card', 99),
      card({ name: 'Extra', board: 'maybeboard', qty: 10, colorIdentity: 'R' }),
    ];
    expect(deckWarnings('commander', withMaybe)).toEqual([]);
  });

  it('does not count a sideboard toward 100', () => {
    const warnings = deckWarnings('commander', [commander, ...fill('Card', 99), card({ name: 'Side', board: 'sideboard' })]);
    expect(warnings.some((warning) => warning.includes('no sideboard'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('has 100'))).toBe(false);
  });

  it('is singleton by name, with the printed exceptions', () => {
    const base = [commander, ...fill('Card', 98)];
    expect(
      deckWarnings('commander', [...base, card({ name: 'Sol Ring', qty: 2 })]).some((warning) =>
        warning.includes('Sol Ring appears 2'),
      ),
    ).toBe(true);

    const basics = deckWarnings('commander', [
      commander,
      ...fill('Card', 89),
      card({ name: 'Forest', qty: 10, typeLine: 'Basic Land — Forest', colorIdentity: 'G' }),
    ]);
    expect(basics.some((warning) => warning.includes('Forest'))).toBe(false);

    const rats = deckWarnings('commander', [
      commander,
      ...fill('Card', 89),
      card({
        name: 'Relentless Rats',
        qty: 10,
        oracleText: 'A deck can have any number of cards named Relentless Rats.',
      }),
    ]);
    expect(rats.some((warning) => warning.includes('Relentless Rats'))).toBe(false);

    expect(
      deckWarnings('commander', [commander, ...fill('Card', 91), card({ name: 'Seven Dwarves', qty: 8 })]).some(
        (warning) => warning.includes('Seven Dwarves appears 8'),
      ),
    ).toBe(true);
    expect(
      deckWarnings('commander', [commander, ...fill('Card', 90), card({ name: 'Nazgûl', qty: 9 })]).some((warning) =>
        warning.includes('Nazgûl'),
      ),
    ).toBe(false);
  });

  it('requires color identity to fit the commander', () => {
    const warnings = deckWarnings('commander', [
      commander,
      ...fill('Card', 98),
      card({ name: 'Lightning Bolt', colorIdentity: 'R' }),
    ]);
    expect(warnings.some((warning) => warning.includes('Lightning Bolt is outside'))).toBe(true);
    expect(
      deckWarnings('commander', [commander, ...fill('Card', 98), card({ name: 'Swords to Plowshares', colorIdentity: 'W' })]),
    ).toEqual([]);
  });

  it('allows one legal commander, or a second for partner, background, or companion', () => {
    expect(deckWarnings('commander', [card({ name: 'Sol Ring', board: 'commander' }), ...fill('Card', 99)])).toEqual(
      expect.arrayContaining([expect.stringContaining("can't be your commander")]),
    );

    const partners = [
      card({
        name: 'Tymna',
        board: 'commander',
        typeLine: 'Legendary Creature — Human Cleric',
        keywords: ['Partner'],
        colorIdentity: 'WB',
      }),
      card({
        name: 'Kraum',
        board: 'commander',
        typeLine: 'Legendary Creature — Human Wizard',
        keywords: ['Partner'],
        colorIdentity: 'UR',
      }),
      ...fill('Spell', 98),
    ];
    expect(deckWarnings('commander', partners)).toEqual([]);

    const named = [
      card({
        name: 'Akroma, Vision of Ixidor',
        board: 'commander',
        typeLine: 'Legendary Creature — Angel',
        keywords: ['Partner with'],
        oracleText: 'Partner with Akroma, Angel of Wrath',
        colorIdentity: 'W',
      }),
      card({
        name: 'Akroma, Angel of Wrath',
        board: 'commander',
        typeLine: 'Legendary Creature — Angel',
        keywords: ['Partner with'],
        oracleText: 'Partner with Akroma, Vision of Ixidor',
        colorIdentity: 'R',
      }),
      ...fill('Spell', 98),
    ];
    expect(deckWarnings('commander', named)).toEqual([]);

    const background = [
      card({
        name: 'Wilson, Refined Grizzly',
        board: 'commander',
        typeLine: 'Legendary Creature — Bear Warrior',
        keywords: ['Choose a Background'],
        colorIdentity: 'G',
      }),
      card({
        name: 'Raised by Giants',
        board: 'commander',
        typeLine: 'Enchantment — Background',
        colorIdentity: 'G',
      }),
      ...fill('Spell', 98),
    ];
    expect(deckWarnings('commander', background)).toEqual([]);

    const doctor = [
      card({
        name: 'The Fourteenth Doctor',
        board: 'commander',
        typeLine: 'Legendary Creature — Time Lord Doctor',
        colorIdentity: 'U',
      }),
      card({
        name: 'Rose Tyler',
        board: 'commander',
        typeLine: 'Legendary Creature — Human',
        keywords: ["Doctor's companion"],
        colorIdentity: 'W',
      }),
      ...fill('Spell', 98),
    ];
    expect(deckWarnings('commander', doctor)).toEqual([]);

    const strangers = [
      card({ name: 'A', board: 'commander', typeLine: 'Legendary Creature — Human' }),
      card({ name: 'B', board: 'commander', typeLine: 'Legendary Creature — Human' }),
      ...fill('Spell', 98),
    ];
    expect(deckWarnings('commander', strangers).some((warning) => warning.includes("can't be paired"))).toBe(true);
  });

  it('lets a planeswalker that says it can be your commander lead the deck', () => {
    const warnings = deckWarnings('commander', [
      card({
        name: 'Grist, the Hunger Tide',
        board: 'commander',
        typeLine: 'Legendary Planeswalker — Grist',
        oracleText: 'Grist, the Hunger Tide can be your commander.',
        colorIdentity: 'BG',
      }),
      ...fill('Card', 99),
    ]);
    expect(warnings).toEqual([]);
  });
});

describe('Standard legality', () => {
  it('requires 60 main-deck cards, ignores the maybeboard, and caps the sideboard at 15', () => {
    expect(deckWarnings('standard', fill('Card', 59)).some((warning) => warning.includes('has 59'))).toBe(true);
    expect(deckWarnings('standard', [...fill('Card', 60), card({ name: 'Extra', board: 'maybeboard', qty: 20 })])).toEqual(
      [],
    );
    expect(
      deckWarnings('standard', [...fill('Card', 60), ...fill('Side', 16, 'sideboard')]).some((warning) =>
        warning.includes('has 16'),
      ),
    ).toBe(true);
    expect(deckWarnings('standard', [...fill('Card', 80), ...fill('Side', 15, 'sideboard')])).toEqual([]);
  });

  it('allows four copies, with the same exceptions as Commander', () => {
    expect(
      deckWarnings('standard', [...fill('Card', 55), card({ name: 'Lightning Bolt', qty: 5 })]).some((warning) =>
        warning.includes('Lightning Bolt appears 5'),
      ),
    ).toBe(true);
    expect(deckWarnings('standard', [...fill('Card', 56), card({ name: 'Island', qty: 4, typeLine: 'Basic Land — Island' })])).toEqual(
      [],
    );
  });

  it('requires Scryfall Standard legality in the main deck and sideboard', () => {
    const warnings = deckWarnings('standard', [
      ...fill('Card', 59),
      card({ name: 'Brainstorm', standardLegality: 'not_legal' }),
      card({ name: 'Oko', board: 'sideboard', standardLegality: 'banned' }),
    ]);
    expect(warnings.some((warning) => warning.includes('Brainstorm is not legal'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('Oko is banned'))).toBe(true);
    expect(
      deckWarnings('standard', [
        ...fill('Card', 60),
        card({ name: 'Banned Maybe', board: 'maybeboard', standardLegality: 'banned' }),
      ]),
    ).toEqual([]);
  });

  it('does not check color identity or require a commander', () => {
    expect(
      deckWarnings('standard', [...fill('Card', 56), card({ name: 'Bolt', qty: 4, colorIdentity: 'R' })]),
    ).toEqual([]);
    expect(
      deckWarnings('standard', [card({ name: 'Atraxa', board: 'commander', typeLine: 'Legendary Creature' }), ...fill('Card', 60)]).some(
        (warning) => warning.includes("don't have a commander"),
      ),
    ).toBe(true);
  });
});

describe('deck tile colors', () => {
  it('uses the commander identity and combines partners', () => {
    expect(
      deckTileIdentity('commander', [
        card({ name: 'Thrasios', board: 'commander', colorIdentity: 'UG' }),
        card({ name: 'Tymna', board: 'commander', colorIdentity: 'WB' }),
        card({ name: 'Bolt', colorIdentity: 'R' }),
      ]),
    ).toBe('WUBG');
  });

  it('waits when the commander identity has not been read', () => {
    expect(deckTileIdentity('commander', [card({ name: 'Atraxa', board: 'commander', colorIdentity: null })])).toBeNull();
    expect(deckTileIdentity('commander', [card({ name: 'Karn', board: 'commander', colorIdentity: '' })])).toBe('');
    expect(deckTileIdentity('commander', [])).toBeNull();
  });

  it('uses main-deck colors and ignores the sideboard', () => {
    expect(
      deckTileIdentity('standard', [
        card({ name: 'Bolt', colorIdentity: 'R' }),
        card({ name: 'Counterspell', colorIdentity: 'U' }),
        card({ name: 'Rest in Peace', board: 'sideboard', colorIdentity: 'W' }),
      ]),
    ).toBe('UR');
  });

  it('skips unread main-deck cards and still shows the colors that are known', () => {
    expect(
      deckTileIdentity('standard', [
        card({ name: 'Bolt', colorIdentity: 'R' }),
        card({ name: 'Unread', colorIdentity: null }),
      ]),
    ).toBe('R');
    expect(deckTileIdentity('standard', [card({ name: 'Unread', colorIdentity: null })])).toBeNull();
  });
});
