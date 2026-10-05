/** Card types drawn as their own bars. Anything else shares one Other bar. */
export const MTG_CHART_TYPES = [
  'Creature',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Planeswalker',
  'Land',
] as const;

const SUPERTYPES = new Set(['Basic', 'Legendary', 'Snow', 'World', 'Ongoing', 'Elite', 'Host', 'Token']);

export type OverviewCard = {
  scryfallId: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  typeLine: string | null;
  name: string;
  qty: number;
};

export type SetCatalogEntry = {
  name: string;
  releasedAt: string | null;
  printedSize: number | null;
  iconSvgUri: string | null;
};

export type TypeBar = {
  type: string;
  count: number;
};

export type SetSummary = {
  code: string;
  name: string;
  releasedAt: string | null;
  iconSvgUri: string | null;
  /** Unique printings in the set, foil and non-foil collapsed. */
  owned: number;
  /** Printed-set collector numbers owned. Null when the set has no printed size. */
  completed: number | null;
  printedSize: number | null;
  percent: number | null;
};

const UNKNOWN_SET = '__unknown__';

export function chartTypesForTypeLine(typeLine: string | null): string[] {
  if (!typeLine?.trim()) return ['Other'];
  const buckets = new Set<string>();
  for (const face of typeLine.split('//')) {
    const head = face.split('—')[0] ?? face;
    for (const word of head.trim().split(/\s+/)) {
      if (!word || SUPERTYPES.has(word)) continue;
      buckets.add((MTG_CHART_TYPES as readonly string[]).includes(word) ? word : 'Other');
    }
  }
  if (buckets.size === 0) return ['Other'];
  return [
    ...MTG_CHART_TYPES.filter((type) => buckets.has(type)),
    ...(buckets.has('Other') ? ['Other'] : []),
  ];
}

/** Foil and non-foil of the same set and collector number are one printing. */
export function printingKey(card: Pick<OverviewCard, 'scryfallId' | 'setCode' | 'collectorNumber'>): string {
  const set = (card.setCode ?? '').trim().toLowerCase();
  const number = (card.collectorNumber ?? '').trim().toLowerCase();
  if (set && number) return `${set}:${number}`;
  return `id:${card.scryfallId}`;
}

/**
 * Numeric collector numbers count toward the printed set, including a suffix
 * such as 127a. A leading letter (A-12) is a bonus sheet and does not.
 */
export function printedCollectorNumber(collectorNumber: string | null): number | null {
  if (!collectorNumber) return null;
  const trimmed = collectorNumber.trim();
  if (/^[A-Za-z]/.test(trimmed)) return null;
  const match = /^0*(\d+)/.exec(trimmed);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function inPrintedSet(collectorNumber: string | null, printedSize: number | null): boolean {
  if (printedSize == null || printedSize <= 0) return false;
  const number = printedCollectorNumber(collectorNumber);
  return number != null && number >= 1 && number <= printedSize;
}

/** Collapse 0127 and 127, and keep a suffix so 127 and 127a stay distinct. */
export function collectorIdentity(collectorNumber: string | null): string | null {
  if (!collectorNumber) return null;
  const trimmed = collectorNumber.trim().toLowerCase();
  if (/^[a-z]/.test(trimmed)) return null;
  const match = /^0*(\d+)(.*)$/.exec(trimmed);
  if (!match) return null;
  return `${Number(match[1])}${match[2] ?? ''}`;
}

export function collectionTypeBars(cards: readonly OverviewCard[]): TypeBar[] {
  const seen = new Map<string, Set<string>>();
  for (const card of cards) {
    const key = printingKey(card);
    for (const type of chartTypesForTypeLine(card.typeLine)) {
      const keys = seen.get(type) ?? new Set<string>();
      keys.add(key);
      seen.set(type, keys);
    }
  }
  const order = [...MTG_CHART_TYPES, 'Other'];
  return order
    .filter((type) => (seen.get(type)?.size ?? 0) > 0)
    .map((type) => ({ type, count: seen.get(type)?.size ?? 0 }));
}

export function collectionCopyTotal(cards: readonly Pick<OverviewCard, 'qty'>[]): number {
  return cards.reduce((sum, card) => sum + card.qty, 0);
}

export function summarizeSets(
  cards: readonly OverviewCard[],
  catalog: ReadonlyMap<string, SetCatalogEntry>,
): SetSummary[] {
  const groups = new Map<string, { name: string; owned: Set<string>; completed: Set<string> }>();

  for (const card of cards) {
    const code = (card.setCode ?? '').trim().toLowerCase();
    const key = code || UNKNOWN_SET;
    const group = groups.get(key) ?? { name: card.setName?.trim() || '', owned: new Set<string>(), completed: new Set<string>() };
    if (!group.name && card.setName?.trim()) group.name = card.setName.trim();
    group.owned.add(printingKey(card));
    const entry = code ? catalog.get(code) : undefined;
    const identity = collectorIdentity(card.collectorNumber);
    if (identity && inPrintedSet(card.collectorNumber, entry?.printedSize ?? null)) {
      group.completed.add(identity);
    }
    groups.set(key, group);
  }

  const summaries: SetSummary[] = [];
  for (const [key, group] of groups) {
    const code = key === UNKNOWN_SET ? '' : key;
    const entry = code ? catalog.get(code) : undefined;
    const printedSize = entry?.printedSize ?? null;
    const hasSize = printedSize != null && printedSize > 0;
    const completed = hasSize ? group.completed.size : null;
    const percent = hasSize && completed != null ? Math.round((completed / printedSize) * 100) : null;
    summaries.push({
      code: key,
      name: entry?.name || group.name || (code ? code.toUpperCase() : 'Unknown set'),
      releasedAt: entry?.releasedAt ?? null,
      iconSvgUri: entry?.iconSvgUri ?? null,
      owned: group.owned.size,
      completed,
      printedSize: hasSize ? printedSize : null,
      percent,
    });
  }

  summaries.sort((a, b) => {
    if (a.releasedAt && b.releasedAt && a.releasedAt !== b.releasedAt) {
      return a.releasedAt < b.releasedAt ? 1 : -1;
    }
    if (a.releasedAt && !b.releasedAt) return -1;
    if (!a.releasedAt && b.releasedAt) return 1;
    return a.name.localeCompare(b.name);
  });

  return summaries;
}

export function filterSetSummaries(sets: readonly SetSummary[], query: string): SetSummary[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...sets];
  return sets.filter((set) => {
    const code = set.code === UNKNOWN_SET ? '' : set.code;
    return set.name.toLowerCase().includes(trimmed) || code.includes(trimmed);
  });
}

export function cardMatchesQuery(
  card: Pick<OverviewCard, 'name' | 'setCode' | 'setName' | 'typeLine'>,
  query: string,
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return [card.name, card.setCode ?? '', card.setName ?? '', card.typeLine ?? ''].join(' ').toLowerCase().includes(trimmed);
}

export function cardInSet(card: Pick<OverviewCard, 'setCode'>, setCode: string): boolean {
  if (setCode === UNKNOWN_SET) return !(card.setCode ?? '').trim();
  return (card.setCode ?? '').trim().toLowerCase() === setCode;
}
