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
  /** Every printing Scryfall files under the set, including showcase cards and tokens. */
  cardCount: number | null;
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

/** Printed size when Scryfall has one. Otherwise the full card count. */
export function checklistSize(entry: Pick<SetCatalogEntry, 'printedSize' | 'cardCount'> | undefined): number | null {
  if (!entry) return null;
  if (entry.printedSize != null && entry.printedSize > 0) return entry.printedSize;
  if (entry.cardCount != null && entry.cardCount > 0) return entry.cardCount;
  return null;
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
    if (identity && inPrintedSet(card.collectorNumber, checklistSize(entry))) {
      group.completed.add(identity);
    }
    groups.set(key, group);
  }

  const summaries: SetSummary[] = [];
  for (const [key, group] of groups) {
    const code = key === UNKNOWN_SET ? '' : key;
    const entry = code ? catalog.get(code) : undefined;
    const printedSize = checklistSize(entry);
    const hasSize = printedSize != null;
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

type CollectorRank = {
  /** 0 is the main set, 1 is a bonus sheet such as A-1, 2 has no number. */
  band: number;
  prefix: string;
  number: number;
  suffix: string;
};

const UNNUMBERED: CollectorRank = { band: 2, prefix: '', number: 0, suffix: '' };

/** Checklist rank: 9, 10, 10a, then A-1, then a blank number. */
function collectorRank(collectorNumber: string | null): CollectorRank {
  const trimmed = collectorNumber?.trim().toLowerCase() ?? '';
  if (!trimmed) return UNNUMBERED;

  const main = /^0*(\d+)(.*)$/.exec(trimmed);
  if (main) {
    const number = Number(main[1]);
    if (!Number.isFinite(number)) return UNNUMBERED;
    return { band: 0, prefix: '', number, suffix: main[2] ?? '' };
  }

  const bonus = /^([a-z]+)[^a-z0-9]*0*(\d+)(.*)$/.exec(trimmed);
  if (bonus) {
    const number = Number(bonus[2]);
    if (!Number.isFinite(number)) return UNNUMBERED;
    return { band: 1, prefix: bonus[1] ?? '', number, suffix: bonus[3] ?? '' };
  }

  return UNNUMBERED;
}

function compareCollectorRank(a: CollectorRank, b: CollectorRank): number {
  if (a.band !== b.band) return a.band - b.band;
  const prefix = a.prefix.localeCompare(b.prefix);
  if (prefix !== 0) return prefix;
  if (a.number !== b.number) return a.number - b.number;
  return a.suffix.localeCompare(b.suffix);
}

/** One base printing from the printed checklist, such as 10 but not 10a. */
export type PrintedSlot = {
  scryfallId: string;
  name: string;
  collectorNumber: string;
  imageUri: string | null;
  setCode: string;
};

export type PrintingEntry<T> = { kind: 'printing'; nonfoil: T | null; foil: T | null };

export type ChecklistEntry<T> =
  | { kind: 'owned'; card: T }
  | PrintingEntry<T>
  | { kind: 'missing'; slot: PrintedSlot };

/**
 * Printed-set slot for a base collector number. A suffix such as 10a, a bonus
 * sheet such as A-1, or a number past the printed size does not fill a slot.
 */
export function printedSlotNumber(collectorNumber: string | null, printedSize: number | null): number | null {
  if (printedSize == null || printedSize <= 0) return null;
  const rank = collectorRank(collectorNumber);
  if (rank.band !== 0 || rank.suffix !== '') return null;
  if (rank.number < 1 || rank.number > printedSize) return null;
  return rank.number;
}

function slotScore(collectorNumber: string, number: number, imageUri: string | null): number {
  const exact = collectorNumber.trim() === String(number) ? 2 : 0;
  return exact + (imageUri ? 1 : 0);
}

/** One Scryfall printing per printed number, preferring 10 over 010. */
export function selectPrintedSlots(
  cards: readonly {
    scryfallId: string;
    name: string;
    collectorNumber: string | null;
    imageUri: string | null;
    setCode: string;
  }[],
  printedSize: number,
): PrintedSlot[] {
  const chosen = new Map<number, PrintedSlot>();
  for (const card of cards) {
    const number = printedSlotNumber(card.collectorNumber, printedSize);
    if (number == null || !card.collectorNumber) continue;
    const slot: PrintedSlot = {
      scryfallId: card.scryfallId,
      name: card.name,
      collectorNumber: card.collectorNumber,
      imageUri: card.imageUri,
      setCode: card.setCode,
    };
    const current = chosen.get(number);
    if (
      !current ||
      slotScore(slot.collectorNumber, number, slot.imageUri) >
        slotScore(current.collectorNumber, number, current.imageUri)
    ) {
      chosen.set(number, slot);
    }
  }
  return [...chosen.values()];
}

type FinishCard = {
  scryfallId: string;
  name: string;
  collectorNumber: string | null;
  foil: boolean;
};

/** Foil and non-foil of one Scryfall printing, in the order those rows first appeared. */
export function groupOwnedPrintings<T extends FinishCard>(owned: readonly T[]): PrintingEntry<T>[] {
  const order: string[] = [];
  const groups = new Map<string, { nonfoil: T | null; foil: T | null }>();
  for (const card of owned) {
    const group = groups.get(card.scryfallId) ?? { nonfoil: null, foil: null };
    if (!groups.has(card.scryfallId)) order.push(card.scryfallId);
    if (card.foil) group.foil = card;
    else group.nonfoil = card;
    groups.set(card.scryfallId, group);
  }
  return order.map((id) => {
    const group = groups.get(id);
    return { kind: 'printing' as const, nonfoil: group?.nonfoil ?? null, foil: group?.foil ?? null };
  });
}

/**
 * One slot per printing. Foil and non-foil share it. Missing printed numbers are added when
 * `slots` is present. Null `slots` keeps the owned printings only, so a set can render first.
 */
export function mergePrintedChecklist<T extends FinishCard>(
  owned: readonly T[],
  slots: readonly PrintedSlot[] | null,
  printedSize: number | null,
): ChecklistEntry<T>[] {
  const printings = groupOwnedPrintings(owned);
  if (!slots || printedSize == null || printedSize <= 0) return printings;

  const ownedNumbers = new Set<number>();
  for (const card of owned) {
    const number = printedSlotNumber(card.collectorNumber, printedSize);
    if (number != null) ownedNumbers.add(number);
  }

  const missing = selectPrintedSlots(slots, printedSize).flatMap((slot) => {
    const number = printedSlotNumber(slot.collectorNumber, printedSize);
    if (number == null || ownedNumbers.has(number)) return [];
    return [{ kind: 'missing' as const, slot }];
  });

  const sortable = [
    ...printings.map((entry) => {
      const card = entry.nonfoil ?? entry.foil;
      return {
        name: card?.name ?? '',
        collectorNumber: card?.collectorNumber ?? null,
        foil: false,
        entry,
      };
    }),
    ...missing.map((entry) => ({
      name: entry.slot.name,
      collectorNumber: entry.slot.collectorNumber,
      foil: false,
      entry,
    })),
  ];

  return sortByCollectorNumber(sortable).map((item) => item.entry);
}

/** Set-screen order: collector number, then non-foil before foil, then name. */
export function sortByCollectorNumber<T extends { name: string; collectorNumber: string | null; foil: boolean }>(
  cards: readonly T[],
): T[] {
  return [...cards].sort((a, b) => {
    const number = compareCollectorRank(collectorRank(a.collectorNumber), collectorRank(b.collectorNumber));
    if (number !== 0) return number;
    if (a.foil !== b.foil) return a.foil ? 1 : -1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
