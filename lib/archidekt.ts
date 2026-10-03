import { categoryForBoard, colorIdentityKey, DeckBoard, DeckFormat } from './deckLegality';
import {
  getScryfallCardsByIds,
  scryfallImageUri,
  scryfallOracleText,
  scryfallStandardLegality,
  scryfallTypeLine,
  ScryfallCard,
} from './scryfall';

export type ArchidektImportedCard = {
  scryfallId: string;
  oracleId: string | null;
  name: string;
  qty: number;
  category: string;
  isCommander: boolean;
  board: DeckBoard;
  foil: boolean;
  imageUri: string | null;
  manaCost: string | null;
  typeLine: string | null;
  colorIdentity: string | null;
  oracleText: string | null;
  keywords: string[];
  standardLegality: string | null;
};

export type ArchidektImportResult = {
  archidektId: string;
  name: string;
  /** Commander or Standard when Archidekt says so. Anything else is null and the user picks. */
  format: DeckFormat | null;
  cards: ArchidektImportedCard[];
};

type ArchidektDeckCard = {
  quantity?: number;
  categories?: string[];
  companion?: boolean | null;
  modifier?: string | null;
  card?: {
    uid?: string;
    name?: string;
    oracleCard?: {
      uid?: string;
      name?: string;
      manaCost?: string;
      type?: string[];
    };
  };
};

/** Archidekt deckFormat 1 is Standard and 3 is Commander. Other formats stay unset. */
export function archidektDeckFormat(deckFormat: unknown): DeckFormat | null {
  if (deckFormat === 1 || deckFormat === '1' || deckFormat === 'standard') return 'standard';
  if (deckFormat === 3 || deckFormat === '3' || deckFormat === 'commander') return 'commander';
  return null;
}

export function archidektFoil(modifier: string | null | undefined): boolean {
  return /\bfoil\b/i.test(modifier ?? '');
}

export function boardForArchidekt(categories: string[] | undefined, companion: boolean | null | undefined): DeckBoard {
  const names = (categories ?? []).map((category) => category.toLowerCase());
  if (names.includes('commander')) return 'commander';
  if (names.includes('sideboard')) return 'sideboard';
  if (names.includes('maybeboard') || companion) return 'maybeboard';
  return 'main';
}

export function extractArchidektId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/archidekt\.com\/decks\/(\d+)/i);
  if (urlMatch) return urlMatch[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

export async function fetchArchidektDeck(urlOrId: string): Promise<ArchidektImportResult> {
  const archidektId = extractArchidektId(urlOrId);
  if (!archidektId) {
    throw new Error('Enter an Archidekt deck URL or numeric ID.');
  }

  const response = await fetch(`https://archidekt.com/api/decks/${archidektId}/`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'HomeMediaLibrary/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load Archidekt deck (${response.status}).`);
  }

  const data = (await response.json()) as {
    id?: number;
    name?: string;
    deckFormat?: unknown;
    error?: string;
    cards?: ArchidektDeckCard[];
  };

  if (data.error || !data.cards) {
    throw new Error(data.error || 'Archidekt deck not found or private.');
  }

  const scryfallIds = data.cards
    .map((row) => row.card?.uid)
    .filter((id): id is string => Boolean(id));

  const scryfallCards = await getScryfallCardsByIds(scryfallIds);
  const byId = new Map(scryfallCards.map((c) => [c.id, c]));

  const merged = new Map<string, ArchidektImportedCard>();
  for (const row of data.cards) {
    const scryfallId = row.card?.uid;
    if (!scryfallId) continue;

    const categories = row.categories?.length ? row.categories : ['Main'];
    const board = boardForArchidekt(categories, row.companion);
    const foil = archidektFoil(row.modifier);
    const scry: ScryfallCard | undefined = byId.get(scryfallId);
    const name = scry?.name || row.card?.oracleCard?.name || row.card?.name || 'Unknown card';
    const qty = row.quantity && row.quantity > 0 ? row.quantity : 1;
    const key = `${scryfallId}|${board}|${foil ? 'foil' : 'nonfoil'}`;
    const existing = merged.get(key);
    if (existing) {
      existing.qty += qty;
      continue;
    }

    merged.set(key, {
      scryfallId,
      oracleId: scry?.oracle_id ?? row.card?.oracleCard?.uid ?? null,
      name,
      qty,
      board,
      foil,
      category: categoryForBoard(board),
      isCommander: board === 'commander',
      imageUri: scry ? scryfallImageUri(scry, 'normal') : null,
      manaCost: scry?.mana_cost ?? scry?.card_faces?.[0]?.mana_cost ?? row.card?.oracleCard?.manaCost ?? null,
      typeLine: scry ? scryfallTypeLine(scry) : null,
      colorIdentity: scry ? colorIdentityKey(scry.color_identity) : null,
      oracleText: scry ? scryfallOracleText(scry) : null,
      keywords: scry?.keywords ?? [],
      standardLegality: scry ? scryfallStandardLegality(scry) : null,
    });
  }

  const cards = [...merged.values()];

  if (cards.length === 0) {
    throw new Error('No cards found in that Archidekt deck.');
  }

  return {
    archidektId,
    name: data.name || `Archidekt ${archidektId}`,
    format: archidektDeckFormat(data.deckFormat),
    cards,
  };
}
