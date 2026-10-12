import { listScryfallSets } from './scryfall';

const MTGJSON = 'https://mtgjson.com/api/v5';

const FILE_NAME = /^[A-Za-z0-9_]+$/;
const SET_CODE = /^[A-Za-z0-9]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type PreconDeckSummary = {
  fileName: string;
  name: string;
  setCode: string;
  releaseDate: string;
};

export type PreconProduct = {
  setCode: string;
  setName: string;
  releaseDate: string;
  decks: PreconDeckSummary[];
};

export type PreconHit = PreconDeckSummary & {
  setName: string;
};

export type PreconPrinting = {
  name: string;
  scryfallId: string;
  qty: number;
  foil: boolean;
  board: 'commander' | 'main';
};

export type ParsedPrecon = {
  name: string;
  cards: PreconPrinting[];
  missingNames: string[];
};

type RawCard = {
  name?: unknown;
  count?: unknown;
  isFoil?: unknown;
  isEtched?: unknown;
  identifiers?: { scryfallId?: unknown };
};

function mtgjsonFetch<T>(path: string): Promise<T> {
  return fetch(`${MTGJSON}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'HomeMediaLibrary/1.0',
    },
  }).then(async (response) => {
    if (!response.ok) throw new Error(`MTGJSON request failed (${response.status})`);
    return response.json() as Promise<T>;
  });
}

function listData(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

function cardName(card: RawCard): string {
  return typeof card.name === 'string' && card.name.trim() ? card.name.trim() : 'A card';
}

function cardQty(card: RawCard): number {
  return typeof card.count === 'number' && card.count > 0 ? Math.floor(card.count) : 1;
}

/** Etched cards are stored as foil. The collection has one premium finish. */
function cardFoil(card: RawCard): boolean {
  return card.isFoil === true || card.isEtched === true;
}

function readCards(value: unknown, board: PreconPrinting['board'], cards: Map<string, PreconPrinting>, missing: string[]) {
  if (!Array.isArray(value)) return;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const card = entry as RawCard;
    const id = card.identifiers?.scryfallId;
    if (typeof id !== 'string' || !id) {
      missing.push(cardName(card));
      continue;
    }
    const foil = cardFoil(card);
    const key = `${id}|${foil ? 'foil' : 'nonfoil'}|${board}`;
    const qty = cardQty(card);
    const existing = cards.get(key);
    if (existing) {
      existing.qty += qty;
      continue;
    }
    cards.set(key, { name: cardName(card), scryfallId: id, qty, foil, board });
  }
}

export function commanderPreconProducts(
  payload: unknown,
  setNames: ReadonlyMap<string, string>,
  today: string,
): PreconProduct[] {
  if (!DAY.test(today)) return [];
  const byFile = new Map<string, PreconDeckSummary>();
  for (const entry of listData(payload)) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as { type?: unknown; fileName?: unknown; name?: unknown; code?: unknown; releaseDate?: unknown };
    if (row.type !== 'Commander Deck') continue;
    if (typeof row.fileName !== 'string' || !FILE_NAME.test(row.fileName)) continue;
    if (typeof row.name !== 'string' || !row.name.trim()) continue;
    if (typeof row.code !== 'string' || !SET_CODE.test(row.code)) continue;
    if (typeof row.releaseDate !== 'string' || !DAY.test(row.releaseDate) || row.releaseDate > today) continue;
    if (byFile.has(row.fileName)) continue;
    byFile.set(row.fileName, {
      fileName: row.fileName,
      name: row.name.trim(),
      setCode: row.code.toUpperCase(),
      releaseDate: row.releaseDate,
    });
  }

  const products = new Map<string, PreconProduct>();
  for (const deck of byFile.values()) {
    const product = products.get(deck.setCode) ?? {
      setCode: deck.setCode,
      setName: setNames.get(deck.setCode.toLowerCase()) ?? deck.setCode,
      releaseDate: deck.releaseDate,
      decks: [],
    };
    if (deck.releaseDate > product.releaseDate) product.releaseDate = deck.releaseDate;
    product.decks.push(deck);
    products.set(deck.setCode, product);
  }

  return [...products.values()]
    .map((product) => ({
      ...product,
      decks: [...product.decks].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.setName.localeCompare(b.setName));
}

export function searchPrecons(products: PreconProduct[], query: string): PreconHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: PreconHit[] = [];
  for (const product of products) {
    for (const deck of product.decks) {
      if (deck.name.toLowerCase().includes(needle) || product.setName.toLowerCase().includes(needle)) {
        hits.push({ ...deck, setName: product.setName });
      }
    }
  }
  return hits;
}

export function parsePreconDeck(payload: unknown): ParsedPrecon {
  const data =
    payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data?: unknown }).data
      : payload;
  if (!data || typeof data !== 'object') throw new Error('This precon could not be read.');
  const deck = data as { name?: unknown; commander?: unknown; mainBoard?: unknown };
  const cards = new Map<string, PreconPrinting>();
  const missingNames: string[] = [];
  readCards(deck.commander, 'commander', cards, missingNames);
  readCards(deck.mainBoard, 'main', cards, missingNames);
  const name = typeof deck.name === 'string' && deck.name.trim() ? deck.name.trim() : 'Commander precon';
  return { name, cards: [...cards.values()], missingNames };
}

export function preconCopyCounts(cards: PreconPrinting[]): { copies: number; foils: number } {
  return cards.reduce(
    (totals, card) => ({
      copies: totals.copies + card.qty,
      foils: totals.foils + (card.foil ? card.qty : 0),
    }),
    { copies: 0, foils: 0 },
  );
}

let cached: { today: string; promise: Promise<PreconProduct[]> } | null = null;

async function fetchCommanderPrecons(today: string): Promise<PreconProduct[]> {
  const [list, sets] = await Promise.all([
    mtgjsonFetch<unknown>('/DeckList.json'),
    listScryfallSets().catch(() => []),
  ]);
  const names = new Map(sets.map((set) => [set.code.toLowerCase(), set.name]));
  return commanderPreconProducts(list, names, today);
}

export function loadCommanderPrecons(today: string): Promise<PreconProduct[]> {
  if (cached?.today === today) return cached.promise;
  const promise = fetchCommanderPrecons(today).catch((error: unknown) => {
    if (cached?.promise === promise) cached = null;
    throw error;
  });
  cached = { today, promise };
  return promise;
}

export async function fetchPreconDeck(fileName: string): Promise<ParsedPrecon> {
  if (!FILE_NAME.test(fileName)) throw new Error('Unknown precon.');
  return parsePreconDeck(await mtgjsonFetch<unknown>(`/decks/${fileName}.json`));
}
