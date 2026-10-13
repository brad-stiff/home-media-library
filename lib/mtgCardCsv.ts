import { MtgCard } from './mtgCards';

const COLUMNS = [
  'Name',
  'Set',
  'Set code',
  'Collector number',
  'Finish',
  'Quantity',
  'Rarity',
  'Mana cost',
  'Type',
  'Color identity',
] as const;

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function compareCards(a: MtgCard, b: MtgCard): number {
  const name = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (name !== 0) return name;
  const set = (a.setCode ?? '').localeCompare(b.setCode ?? '', undefined, { sensitivity: 'base' });
  if (set !== 0) return set;
  const number = (a.collectorNumber ?? '').localeCompare(b.collectorNumber ?? '', undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (number !== 0) return number;
  if (a.foil !== b.foil) return a.foil ? 1 : -1;
  return 0;
}

function row(card: MtgCard): string {
  const fields = [
    card.name,
    card.setName ?? '',
    card.setCode ?? '',
    card.collectorNumber ?? '',
    card.foil ? 'Foil' : 'Nonfoil',
    String(card.qty),
    card.rarity ?? '',
    card.manaCost ?? '',
    card.typeLine ?? '',
    card.colorIdentity ?? '',
  ];
  return fields.map(csvField).join(',');
}

/** UTF-8 CSV of owned printings, with a BOM so Excel keeps accents. */
export function mtgCardsToCsv(cards: readonly MtgCard[]): string {
  const lines = [COLUMNS.join(','), ...[...cards].sort(compareCards).map(row)];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
