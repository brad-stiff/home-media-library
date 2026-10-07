import AsyncStorage from '@react-native-async-storage/async-storage';

import { PrintedSlot, selectPrintedSlots, SetCatalogEntry } from './mtgOverview';
import { listScryfallSetPrintings, listScryfallSets, scryfallDisplayName, scryfallImageUri } from './scryfall';

const CACHE_KEY = 'mtg-set-catalog-v2';
const CHECKLIST_CACHE_KEY = 'mtg-printed-checklists-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHED_CHECKLISTS = 12;

type CachePayload = {
  fetchedAt: number;
  sets: { code: string; entry: SetCatalogEntry }[];
};

function toMap(sets: { code: string; entry: SetCatalogEntry }[]): Map<string, SetCatalogEntry> {
  return new Map(sets.map((set) => [set.code, set.entry]));
}

async function readCache(): Promise<CachePayload | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed || !Array.isArray(parsed.sets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadMtgSetCatalog(ownedCodes: readonly string[]): Promise<Map<string, SetCatalogEntry>> {
  const needed = new Set(ownedCodes.map((code) => code.trim().toLowerCase()).filter(Boolean));
  const cached = await readCache();
  const fresh = cached != null && Date.now() - cached.fetchedAt < MAX_AGE_MS;
  const coversOwned =
    cached != null &&
    [...needed].every((code) => {
      const row = cached.sets.find((set) => set.code === code);
      return row != null && row.entry != null && 'cardCount' in row.entry;
    });
  if (cached && fresh && coversOwned) return toMap(cached.sets);

  try {
    const remote = await listScryfallSets();
    const sets = remote.map((set) => ({
      code: set.code.trim().toLowerCase(),
      entry: {
        name: set.name,
        releasedAt: set.released_at ?? null,
        printedSize: set.printed_size ?? null,
        cardCount: set.card_count ?? null,
        iconSvgUri: set.icon_svg_uri ?? null,
      } satisfies SetCatalogEntry,
    }));
    const payload: CachePayload = { fetchedAt: Date.now(), sets };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    return toMap(sets);
  } catch {
    return cached ? toMap(cached.sets) : new Map();
  }
}

type ChecklistCache = Record<string, { fetchedAt: number; printedSize: number; slots: PrintedSlot[] }>;

async function readChecklistCache(): Promise<ChecklistCache> {
  const raw = await AsyncStorage.getItem(CHECKLIST_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ChecklistCache;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function pruneChecklists(cache: ChecklistCache): void {
  const entries = Object.entries(cache);
  if (entries.length <= MAX_CACHED_CHECKLISTS) return;
  entries.sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
  for (const [code] of entries.slice(0, entries.length - MAX_CACHED_CHECKLISTS)) {
    delete cache[code];
  }
}

/** Base printings 1..printedSize for a set. Cached so opening a set again skips Scryfall. */
export async function loadPrintedChecklist(setCode: string, printedSize: number): Promise<PrintedSlot[]> {
  const code = setCode.trim().toLowerCase();
  if (!/^[a-z0-9]+$/.test(code) || printedSize <= 0) return [];

  const cache = await readChecklistCache();
  const hit = cache[code];
  if (hit && hit.printedSize === printedSize && Date.now() - hit.fetchedAt < MAX_AGE_MS && Array.isArray(hit.slots)) {
    return hit.slots;
  }

  const cards = await listScryfallSetPrintings(code, printedSize);
  const slots = selectPrintedSlots(
    cards.map((card) => ({
      scryfallId: card.id,
      name: scryfallDisplayName(card),
      collectorNumber: card.collector_number ?? null,
      imageUri: scryfallImageUri(card, 'small'),
      setCode: code,
    })),
    printedSize,
  );

  cache[code] = { fetchedAt: Date.now(), printedSize, slots };
  pruneChecklists(cache);
  try {
    await AsyncStorage.setItem(CHECKLIST_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // The checklist still renders. The next open can try to cache it again.
  }
  return slots;
}
