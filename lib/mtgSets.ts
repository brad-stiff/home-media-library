import AsyncStorage from '@react-native-async-storage/async-storage';

import { listScryfallSets } from './scryfall';
import { SetCatalogEntry } from './mtgOverview';

const CACHE_KEY = 'mtg-set-catalog-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
  const coversOwned = cached != null && [...needed].every((code) => cached.sets.some((set) => set.code === code));
  if (cached && fresh && coversOwned) return toMap(cached.sets);

  try {
    const remote = await listScryfallSets();
    const sets = remote.map((set) => ({
      code: set.code.trim().toLowerCase(),
      entry: {
        name: set.name,
        releasedAt: set.released_at ?? null,
        printedSize: set.printed_size ?? null,
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
