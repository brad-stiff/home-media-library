const SCRYFALL = 'https://api.scryfall.com';

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HomeMediaLibrary/1.0',
};

export type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  type_line?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  rarity?: string;
  color_identity?: string[];
  keywords?: string[];
  oracle_text?: string;
  legalities?: {
    standard?: string;
  };
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
  };
  card_faces?: {
    name?: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    image_uris?: { small?: string; normal?: string; large?: string };
  }[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scryfallFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SCRYFALL}${path}`, {
    ...init,
    headers: {
      ...DEFAULT_HEADERS,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const err = new Error(`Scryfall request failed (${response.status})`) as Error & {
      status?: number;
    };
    err.status = response.status;
    throw err;
  }

  return response.json() as Promise<T>;
}

export function scryfallImageUri(card: ScryfallCard, size: 'small' | 'normal' = 'normal'): string | null {
  if (card.image_uris?.[size] || card.image_uris?.normal) {
    return card.image_uris[size] ?? card.image_uris.normal ?? null;
  }
  const face = card.card_faces?.[0];
  return face?.image_uris?.[size] ?? face?.image_uris?.normal ?? null;
}

export function scryfallDisplayName(card: ScryfallCard): string {
  return card.name;
}

export function scryfallOracleText(card: ScryfallCard): string {
  if (card.oracle_text) return card.oracle_text;
  return (card.card_faces ?? [])
    .map((face) => face.oracle_text)
    .filter((text): text is string => Boolean(text))
    .join('\n');
}

export function scryfallTypeLine(card: ScryfallCard): string | null {
  if (card.type_line) return card.type_line;
  const faces = (card.card_faces ?? []).map((face) => face.type_line).filter((type): type is string => Boolean(type));
  return faces.length > 0 ? faces.join(' // ') : null;
}

export function scryfallStandardLegality(card: ScryfallCard): string | null {
  return card.legalities?.standard ?? null;
}

export async function searchScryfallCards(query: string): Promise<ScryfallCard[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const data = await scryfallFetch<{ data: ScryfallCard[] }>(
      `/cards/search?q=${encodeURIComponent(trimmed)}&unique=prints`,
    );
    return data.data.slice(0, 40);
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
      return [];
    }
    throw error;
  }
}

export async function getScryfallCard(id: string): Promise<ScryfallCard> {
  return scryfallFetch<ScryfallCard>(`/cards/${id}`);
}

/** Resolve up to 75 ids per request; chunks + polite delay between batches. */
export async function getScryfallCardsByIds(ids: string[]): Promise<ScryfallCard[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out: ScryfallCard[] = [];

  for (let i = 0; i < unique.length; i += 75) {
    if (i > 0) await sleep(100);
    const chunk = unique.slice(i, i + 75);
    const data = await scryfallFetch<{ data: ScryfallCard[]; not_found?: unknown[] }>(
      '/cards/collection',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifiers: chunk.map((id) => ({ id })),
        }),
      },
    );
    out.push(...(data.data ?? []));
  }

  return out;
}
