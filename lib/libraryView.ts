export const DOCK_TYPES = ['movies', 'books', 'games', 'mtg', 'pokemon'] as const;

export type DockType = (typeof DOCK_TYPES)[number];

export type LibraryLayout = 'grid' | 'list';

export type LibraryDensity = 'comfortable' | 'compact';

export type CatalogSort = 'title' | 'year' | 'added';

export type MtgCollectionSort = CatalogSort | 'set' | 'color' | 'qty';

export type DeckSort = 'title' | 'added';

export type AvailabilityFilter = 'all' | 'available' | 'out';

export type OpeningTab = 'resume' | DockType;

export type TabViewPrefs = {
  layout: LibraryLayout;
  sort: CatalogSort;
  availability: AvailabilityFilter;
};

export type MtgTabViewPrefs = {
  layout: LibraryLayout;
  sort: MtgCollectionSort;
  availability: AvailabilityFilter;
};

export type DeckViewPrefs = {
  sort: DeckSort;
};

export type LibraryViewPrefs = {
  opening: OpeningTab;
  lastTab: DockType | null;
  dockOrder: DockType[];
  density: LibraryDensity;
  movies: TabViewPrefs;
  books: TabViewPrefs;
  games: TabViewPrefs;
  mtg: MtgTabViewPrefs;
  pokemon: TabViewPrefs;
  decks: DeckViewPrefs;
};

export const DOCK_LABELS: Record<DockType, string> = {
  movies: 'Movies',
  books: 'Books',
  games: 'Games',
  mtg: 'MTG',
  pokemon: 'Pokémon',
};

export const CATALOG_SORTS: { id: CatalogSort; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'year', label: 'Year' },
  { id: 'added', label: 'Date added' },
];

export const MTG_COLLECTION_SORTS: { id: MtgCollectionSort; label: string }[] = [
  ...CATALOG_SORTS,
  { id: 'set', label: 'Set' },
  { id: 'color', label: 'Color' },
  { id: 'qty', label: 'Qty' },
];

export const DECK_SORTS: { id: DeckSort; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'added', label: 'Date added' },
];

export const AVAILABILITY_FILTERS: { id: AvailabilityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'out', label: 'Checked out' },
];

const DEFAULT_DOCK_ORDER: DockType[] = ['movies', 'books', 'games', 'mtg', 'pokemon'];

function defaultTabPrefs(): TabViewPrefs {
  return { layout: 'grid', sort: 'title', availability: 'all' };
}

export function defaultLibraryView(): LibraryViewPrefs {
  return {
    opening: 'resume',
    lastTab: null,
    dockOrder: [...DEFAULT_DOCK_ORDER],
    density: 'comfortable',
    movies: defaultTabPrefs(),
    books: defaultTabPrefs(),
    games: defaultTabPrefs(),
    mtg: defaultTabPrefs(),
    pokemon: defaultTabPrefs(),
    decks: { sort: 'title' },
  };
}

export function isDockType(value: unknown): value is DockType {
  return typeof value === 'string' && (DOCK_TYPES as readonly string[]).includes(value);
}

function isLayout(value: unknown): value is LibraryLayout {
  return value === 'grid' || value === 'list';
}

function isDensity(value: unknown): value is LibraryDensity {
  return value === 'comfortable' || value === 'compact';
}

function isCatalogSort(value: unknown): value is CatalogSort {
  return value === 'title' || value === 'year' || value === 'added';
}

function isMtgCollectionSort(value: unknown): value is MtgCollectionSort {
  return isCatalogSort(value) || value === 'set' || value === 'color' || value === 'qty';
}

function isDeckSort(value: unknown): value is DeckSort {
  return value === 'title' || value === 'added';
}

function isAvailability(value: unknown): value is AvailabilityFilter {
  return value === 'all' || value === 'available' || value === 'out';
}

export function normalizeDockOrder(order: unknown): DockType[] {
  const seen = new Set<DockType>();
  const result: DockType[] = [];
  if (Array.isArray(order)) {
    for (const item of order) {
      if (isDockType(item) && !seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
    }
  }
  for (const type of DEFAULT_DOCK_ORDER) {
    if (!seen.has(type)) result.push(type);
  }
  return result;
}

function parseTabPrefs(value: unknown): TabViewPrefs {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    layout: isLayout(raw.layout) ? raw.layout : 'grid',
    sort: isCatalogSort(raw.sort) ? raw.sort : 'title',
    availability: isAvailability(raw.availability) ? raw.availability : 'all',
  };
}

function parseMtgTabPrefs(value: unknown): MtgTabViewPrefs {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    layout: isLayout(raw.layout) ? raw.layout : 'grid',
    sort: isMtgCollectionSort(raw.sort) ? raw.sort : 'title',
    availability: isAvailability(raw.availability) ? raw.availability : 'all',
  };
}

export function parseLibraryView(value: unknown): LibraryViewPrefs {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const opening = raw.opening === 'resume' || isDockType(raw.opening) ? raw.opening : 'resume';
  return {
    opening,
    lastTab: isDockType(raw.lastTab) ? raw.lastTab : null,
    dockOrder: normalizeDockOrder(raw.dockOrder),
    density: isDensity(raw.density) ? raw.density : 'comfortable',
    movies: parseTabPrefs(raw.movies),
    books: parseTabPrefs(raw.books),
    games: parseTabPrefs(raw.games),
    mtg: parseMtgTabPrefs(raw.mtg),
    pokemon: parseTabPrefs(raw.pokemon),
    decks: {
      sort:
        raw.decks && typeof raw.decks === 'object' && isDeckSort((raw.decks as { sort?: unknown }).sort)
          ? (raw.decks as { sort: DeckSort }).sort
          : 'title',
    },
  };
}

export function visibleDockTabs(
  order: readonly DockType[],
  isVisible: (type: DockType) => boolean,
): DockType[] {
  return order.filter((type) => isVisible(type));
}

export function resolveOpeningTab(
  prefs: LibraryViewPrefs,
  visible: readonly DockType[],
): DockType | null {
  if (visible.length === 0) return null;
  if (prefs.opening !== 'resume' && visible.includes(prefs.opening)) return prefs.opening;
  if (prefs.lastTab && visible.includes(prefs.lastTab)) return prefs.lastTab;
  return visible[0];
}

export function moveDockTab(
  order: readonly DockType[],
  visible: readonly DockType[],
  tab: DockType,
  direction: -1 | 1,
): DockType[] {
  const visibleNow = order.filter((type) => visible.includes(type));
  const index = visibleNow.indexOf(tab);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= visibleNow.length) return [...order];
  const swapped = [...visibleNow];
  const current = swapped[index];
  const neighbor = swapped[next];
  if (!current || !neighbor) return [...order];
  swapped[index] = neighbor;
  swapped[next] = current;
  let cursor = 0;
  return order.map((type) => {
    if (!visible.includes(type)) return type;
    const replacement = swapped[cursor];
    cursor += 1;
    return replacement ?? type;
  });
}

export function withTabPrefs(
  prefs: LibraryViewPrefs,
  tab: DockType,
  patch: Partial<{ layout: LibraryLayout; sort: MtgCollectionSort; availability: AvailabilityFilter }>,
): LibraryViewPrefs {
  if (tab === 'mtg') {
    return { ...prefs, mtg: { ...prefs.mtg, ...patch } };
  }
  const current = prefs[tab];
  return {
    ...prefs,
    [tab]: {
      ...current,
      ...(patch.layout ? { layout: patch.layout } : {}),
      ...(patch.availability ? { availability: patch.availability } : {}),
      sort: patch.sort && isCatalogSort(patch.sort) ? patch.sort : current.sort,
    },
  };
}

type CatalogFields<T> = {
  title: (item: T) => string;
  year: (item: T) => string | null;
  addedAt: (item: T) => string;
};

function compareTitle(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function yearValue(year: string | null): number | null {
  if (!year) return null;
  const parsed = Number(year.slice(0, 4));
  return Number.isFinite(parsed) ? parsed : null;
}

export function sortCatalog<T>(
  items: readonly T[],
  sort: CatalogSort,
  fields: CatalogFields<T>,
): T[] {
  return [...items].sort((a, b) => {
    if (sort === 'year') {
      const ay = yearValue(fields.year(a));
      const by = yearValue(fields.year(b));
      if (ay == null && by != null) return 1;
      if (ay != null && by == null) return -1;
      if (ay != null && by != null && ay !== by) return by - ay;
    }
    if (sort === 'added') {
      const added = fields.addedAt(b).localeCompare(fields.addedAt(a));
      if (added !== 0) return added;
    }
    return compareTitle(fields.title(a), fields.title(b));
  });
}

const COLOR_RANK: Record<string, number> = { W: 0, U: 1, B: 2, R: 3, G: 4 };

function colorGroup(identity: string | null): number {
  if (identity == null) return 8;
  if (identity.length === 0) return 7;
  if (identity.length > 1) return 5;
  return COLOR_RANK[identity] ?? 6;
}

function collectorValue(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sortMtgCollection<T>(
  items: readonly T[],
  sort: MtgCollectionSort,
  fields: CatalogFields<T> & {
    setName: (item: T) => string | null;
    collectorNumber: (item: T) => string | null;
    colorIdentity: (item: T) => string | null;
    qty: (item: T) => number;
  },
): T[] {
  if (sort === 'title' || sort === 'year' || sort === 'added') {
    return sortCatalog(items, sort, fields);
  }

  return [...items].sort((a, b) => {
    if (sort === 'qty') {
      const qty = fields.qty(b) - fields.qty(a);
      if (qty !== 0) return qty;
    }
    if (sort === 'set') {
      const set = compareTitle(fields.setName(a) ?? '\uffff', fields.setName(b) ?? '\uffff');
      if (set !== 0) return set;
      const an = collectorValue(fields.collectorNumber(a));
      const bn = collectorValue(fields.collectorNumber(b));
      if (an == null && bn != null) return 1;
      if (an != null && bn == null) return -1;
      if (an != null && bn != null && an !== bn) return an - bn;
    }
    if (sort === 'color') {
      const color = colorGroup(fields.colorIdentity(a)) - colorGroup(fields.colorIdentity(b));
      if (color !== 0) return color;
      const identity = (fields.colorIdentity(a) ?? '').localeCompare(fields.colorIdentity(b) ?? '');
      if (identity !== 0) return identity;
    }
    return compareTitle(fields.title(a), fields.title(b));
  });
}

export function sortDecks<T>(
  items: readonly T[],
  sort: DeckSort,
  fields: { title: (item: T) => string; addedAt: (item: T) => string },
): T[] {
  return [...items].sort((a, b) => {
    if (sort === 'added') {
      const added = fields.addedAt(b).localeCompare(fields.addedAt(a));
      if (added !== 0) return added;
    }
    return compareTitle(fields.title(a), fields.title(b));
  });
}
