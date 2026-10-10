export type SleeveLine = 'matte' | 'dual';

export type DragonSleeve = {
  id: string;
  name: string;
  line: SleeveLine;
  /** Back of the sleeve, the face you see across a deck. */
  outer: string;
  /** Interior edge. Null when the sleeve is a single color. */
  inner: string | null;
};

const BLACK = '#141414';
const SILVER = '#C5C8CE';
const GOLD = '#C6A15B';

/**
 * Dragon Shield Matte and Matte Dual colors.
 * Hex values are display approximations of the printed sleeves, not official artwork.
 */
const MATTE: [string, string][] = [
  ['Amazonite', '#3EBFB0'],
  ['Amber', '#E39B2B'],
  ['Amethyst', '#7D5BA6'],
  ['Apple Green', '#8FBF2F'],
  ['Aurora', '#6ED0C8'],
  ['Black', '#2A2A2A'],
  ['Blood Red', '#7A1E2C'],
  ['Blue', '#1F4E9A'],
  ['Clear', '#E6EEF2'],
  ['Copper', '#B87333'],
  ['Crimson', '#A32036'],
  ['Emerald', '#0E7A4B'],
  ['Forest Green', '#1E4D32'],
  ['Gold', GOLD],
  ['Green', '#2F8F3A'],
  ['Ivory', '#F3E6C8'],
  ['Jet', '#121212'],
  ['Magenta', '#C2186A'],
  ['Midnight Blue', '#0E2344'],
  ['Mint', '#9ED9C4'],
  ['Orange', '#F26B1D'],
  ['Petrol', '#1A535C'],
  ['Pink', '#F2A3C2'],
  ['Pink Diamond', '#F6D0DE'],
  ['Pink Sapphire', '#D56B93'],
  ['Purple', '#6432A0'],
  ['Ruby', '#9B1D3A'],
  ['Sapphire', '#0E3F86'],
  ['Silver', SILVER],
  ['Turquoise', '#2BB8C4'],
  ['White', '#F7F5F2'],
  ['Yellow', '#F5D000'],
];

/** Classic Matte Dual: colored back, black interior. */
const DUAL_BLACK: [string, string][] = [
  ['Crypt', '#1C1C1C'],
  ['Ember', '#E36A2A'],
  ['Eucalyptus', '#5E8C6A'],
  ['Fury', '#C0392B'],
  ['Glacier', '#9BB8C9'],
  ['Justice', SILVER],
  ['Lagoon', '#1F7A8C'],
  ['Lightning', '#E6B325'],
  ['Might', '#7A1F2B'],
  ['Orchid', '#B56BB3'],
  ['Peach', '#F3B183'],
  ['Power', '#5B3A8C'],
  ['Snow', '#F4F0E6'],
  ['Soul', '#6E7FBF'],
  ['Truth', GOLD],
  ['Valor', '#1E4E8C'],
  ['Wisdom', '#3E6B45'],
  ['Wraith', '#4E4A63'],
];

/** Matte Dual with a colored interior. */
const DUAL_PAIR: [string, string, string][] = [
  ['Apple Green & Silver', '#8FBF2F', SILVER],
  ['Black & Gold', '#1A1A1A', GOLD],
  ['Cobalt & Silver', '#1E4B8C', SILVER],
  ['Crimson & Silver', '#A32036', SILVER],
  ['Nebula & Silver', '#3D2E6B', SILVER],
  ['Pomegranate & Gold', '#9B2335', GOLD],
  ['Power & Copper', '#5B3A8C', '#B87333'],
  ['Sky Blue & Silver', '#7EC8E3', SILVER],
  ['Soul & Petrol', '#6E7FBF', '#1A535C'],
  ['Yellow & Silver', '#F5D000', SILVER],
];

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function matte(name: string, outer: string): DragonSleeve {
  return { id: `matte-${slug(name)}`, name, line: 'matte', outer, inner: null };
}

function dual(name: string, outer: string, inner: string): DragonSleeve {
  return { id: `dual-${slug(name)}`, name, line: 'dual', outer, inner };
}

export const SLEEVES: DragonSleeve[] = [
  ...MATTE.map(([name, outer]) => matte(name, outer)),
  ...DUAL_BLACK.map(([name, outer]) => dual(name, outer, BLACK)),
  ...DUAL_PAIR.map(([name, outer, inner]) => dual(name, outer, inner)),
];

const BY_ID = new Map(SLEEVES.map((sleeve) => [sleeve.id, sleeve]));

export function sleeveById(id: string | null | undefined): DragonSleeve | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function sleeveLabel(sleeve: DragonSleeve): string {
  return sleeve.line === 'dual' ? `${sleeve.name} dual` : `${sleeve.name} matte`;
}

export function sleevesIn(line: SleeveLine): DragonSleeve[] {
  return SLEEVES.filter((sleeve) => sleeve.line === line);
}
