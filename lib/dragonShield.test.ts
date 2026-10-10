import { describe, expect, it } from 'vitest';

import { partitionDecks, isDeckSleeveImageUrl } from './deckSleeve';
import { SLEEVES, sleeveById, sleeveLabel } from './dragonShield';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('dragon shield sleeves', () => {
  it('keeps ids unique and storable', () => {
    expect(new Set(SLEEVES.map((sleeve) => sleeve.id)).size).toBe(SLEEVES.length);
    for (const sleeve of SLEEVES) {
      expect(sleeve.id).toMatch(ID);
      expect(sleeve.outer).toMatch(/^#[0-9A-F]{6}$/);
      if (sleeve.line === 'matte') expect(sleeve.inner).toBeNull();
      if (sleeve.line === 'dual') expect(sleeve.inner).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('finds Jet matte and a two-color dual', () => {
    const jet = sleeveById('matte-jet');
    expect(jet?.name).toBe('Jet');
    expect(sleeveLabel(jet!)).toBe('Jet matte');
    const crimson = sleeveById('dual-crimson-silver');
    expect(crimson?.inner).toBeTruthy();
    expect(sleeveLabel(crimson!)).toBe('Crimson & Silver dual');
    expect(sleeveById('nope')).toBeNull();
    expect(sleeveById(null)).toBeNull();
  });
});

describe('deck sleeves and archive', () => {
  it('accepts only this project’s sleeve photo urls', () => {
    const previous = process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    try {
      const deck = '11111111-1111-1111-1111-111111111111';
      const home = '22222222-2222-2222-2222-222222222222';
      const url = `https://example.supabase.co/storage/v1/object/public/deck-sleeves/${home}/${deck}?t=12`;
      expect(isDeckSleeveImageUrl(url)).toBe(true);
      expect(
        isDeckSleeveImageUrl(`https://evil.example/storage/v1/object/public/deck-sleeves/${home}/${deck}?t=12`),
      ).toBe(false);
      expect(isDeckSleeveImageUrl(url.replace('?t=12', ''))).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      else process.env.EXPO_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it('keeps active decks ahead of archived ones without reordering either group', () => {
    const decks = [
      { name: 'Built', archivedAt: null },
      { name: 'Old', archivedAt: '2026-01-01' },
      { name: 'New', archivedAt: null },
    ];
    expect(partitionDecks(decks)).toEqual({
      active: [decks[0], decks[2]],
      archived: [decks[1]],
    });
  });
});
