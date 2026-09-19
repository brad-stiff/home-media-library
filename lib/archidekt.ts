import { getScryfallCardsByIds, scryfallImageUri, ScryfallCard } from './scryfall';

export type ArchidektImportedCard = {
  scryfallId: string;
  oracleId: string | null;
  name: string;
  qty: number;
  category: string;
  isCommander: boolean;
  imageUri: string | null;
  manaCost: string | null;
  typeLine: string | null;
};

export type ArchidektImportResult = {
  archidektId: string;
  name: string;
  cards: ArchidektImportedCard[];
};

type ArchidektDeckCard = {
  quantity?: number;
  categories?: string[];
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

function extractArchidektId(input: string): string | null {
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

  const cards: ArchidektImportedCard[] = [];
  for (const row of data.cards) {
    const scryfallId = row.card?.uid;
    if (!scryfallId) continue;

    const categories = row.categories?.length ? row.categories : ['Deck'];
    const isCommander = categories.some((c) => c.toLowerCase() === 'commander');
    const category = isCommander ? 'Commander' : categories[0] || 'Deck';
    const scry: ScryfallCard | undefined = byId.get(scryfallId);
    const name =
      scry?.name ||
      row.card?.oracleCard?.name ||
      row.card?.name ||
      'Unknown card';

    cards.push({
      scryfallId,
      oracleId: scry?.oracle_id ?? row.card?.oracleCard?.uid ?? null,
      name,
      qty: row.quantity && row.quantity > 0 ? row.quantity : 1,
      category,
      isCommander,
      imageUri: scry ? scryfallImageUri(scry, 'normal') : null,
      manaCost: scry?.mana_cost ?? row.card?.oracleCard?.manaCost ?? null,
      typeLine: scry?.type_line ?? null,
    });
  }

  if (cards.length === 0) {
    throw new Error('No cards found in that Archidekt deck.');
  }

  return {
    archidektId,
    name: data.name || `Archidekt ${archidektId}`,
    cards,
  };
}
