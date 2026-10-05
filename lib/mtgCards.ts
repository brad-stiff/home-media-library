import { Tables } from './database.types';
import { colorIdentityKey } from './deckLegality';
import { cardMatchesQuery } from './mtgOverview';
import { getMyHousehold } from './household';
import { pageAll } from './pageAll';
import { getScryfallCardsByIds, ScryfallCard, scryfallDisplayName, scryfallImageUri } from './scryfall';
import { supabase } from './supabase';

export type MtgCard = {
  id: string;
  householdId: string;
  scryfallId: string;
  oracleId: string | null;
  name: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  manaCost: string | null;
  typeLine: string | null;
  rarity: string | null;
  imageUri: string | null;
  qty: number;
  foil: boolean;
  colorIdentity: string | null;
  addedBy: string | null;
  addedByName: string | null;
  addedAt: string;
};

type MtgCardRow = Tables<'mtg_cards'>;

function rowToCard(row: MtgCardRow): MtgCard {
  return {
    id: row.id,
    householdId: row.household_id,
    scryfallId: row.scryfall_id,
    oracleId: row.oracle_id,
    name: row.name,
    setCode: row.set_code,
    setName: row.set_name,
    collectorNumber: row.collector_number,
    manaCost: row.mana_cost,
    typeLine: row.type_line,
    rarity: row.rarity,
    imageUri: row.image_uri,
    qty: row.qty,
    foil: row.foil,
    colorIdentity: row.color_identity,
    addedBy: row.added_by,
    addedByName: row.added_by_name,
    addedAt: row.created_at,
  };
}

export async function getAllMtgCards(): Promise<MtgCard[]> {
  const rows = await pageAll((from, to) =>
    supabase
      .from('mtg_cards')
      .select('*')
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows.map(rowToCard);
}

export async function getMtgCard(id: string): Promise<MtgCard | null> {
  const { data, error } = await supabase.from('mtg_cards').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToCard(data) : null;
}

export async function searchMtgCollection(query: string): Promise<MtgCard[]> {
  const cards = await getAllMtgCards();
  return cards.filter((c) => cardMatchesQuery(c, query));
}

export async function addMtgCardFromScryfall(
  card: ScryfallCard,
  options?: { qty?: number; foil?: boolean },
): Promise<MtgCard> {
  const household = await getMyHousehold();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const qty = options?.qty && options.qty > 0 ? options.qty : 1;
  const foil = !!options?.foil;
  const colorIdentity = colorIdentityKey(card.color_identity);

  const { data: existing } = await supabase
    .from('mtg_cards')
    .select('*')
    .eq('household_id', household.householdId)
    .eq('scryfall_id', card.id)
    .eq('foil', foil)
    .maybeSingle();

  if (existing) {
    const row = existing;
    const { data, error } = await supabase
      .from('mtg_cards')
      .update({
        qty: row.qty + qty,
        color_identity: row.color_identity ?? colorIdentity,
      })
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) {
      if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
        throw new Error('Only the person who added this card, or an admin, can change the quantity.');
      }
      throw error;
    }
    if (!data) throw new Error('Could not update this card.');
    return rowToCard(data);
  }

  const { data, error } = await supabase
    .from('mtg_cards')
    .insert({
      household_id: household.householdId,
      scryfall_id: card.id,
      oracle_id: card.oracle_id ?? null,
      name: scryfallDisplayName(card),
      set_code: card.set ?? null,
      set_name: card.set_name ?? null,
      collector_number: card.collector_number ?? null,
      mana_cost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
      type_line: card.type_line ?? null,
      rarity: card.rarity ?? null,
      image_uri: scryfallImageUri(card, 'normal'),
      qty,
      foil,
      color_identity: colorIdentity,
      added_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Could not add this card.');
  return rowToCard(data);
}

export async function updateMtgCardQty(id: string, qty: number): Promise<void> {
  if (qty < 1) {
    await deleteMtgCard(id);
    return;
  }
  const { data, error } = await supabase.from('mtg_cards').update({ qty }).eq('id', id).select('id');
  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new Error('Only the person who added this card, or an admin, can change the quantity.');
    }
    throw error;
  }
  if (!data?.length) {
    throw new Error('Only the person who added this card, or an admin, can change the quantity.');
  }
}

const colorCache = new Map<string, string>();
const COLOR_WRITE_CHUNK = 200;

/**
 * Fills missing Scryfall color identity for collection sorts.
 * One household function writes the blanks, including cards this user cannot otherwise edit.
 */
export async function attachColorIdentities(cards: MtgCard[]): Promise<MtgCard[]> {
  const unresolved = cards.filter((card) => card.colorIdentity == null && !colorCache.has(card.scryfallId));
  if (unresolved.length > 0) {
    const found = await getScryfallCardsByIds(unresolved.map((card) => card.scryfallId));
    for (const card of found) {
      colorCache.set(card.id, colorIdentityKey(card.color_identity));
    }
  }

  const next = cards.map((card) => {
    if (card.colorIdentity != null) return card;
    const identity = colorCache.get(card.scryfallId);
    return identity == null ? card : { ...card, colorIdentity: identity };
  });

  const pending = next.flatMap((card, index) => {
    const previous = cards[index];
    if (!previous || previous.colorIdentity != null || card.colorIdentity == null) return [];
    return [{ id: card.id, color_identity: card.colorIdentity }];
  });

  try {
    for (let index = 0; index < pending.length; index += COLOR_WRITE_CHUNK) {
      const { error } = await supabase.rpc('fill_mtg_color_identities', {
        p_cards: pending.slice(index, index + COLOR_WRITE_CHUNK),
      });
      if (error) throw error;
    }
  } catch {
    // Until the household function is installed, store colors on rows this user may already edit.
    await Promise.all(
      pending.map((card) =>
        supabase.from('mtg_cards').update({ color_identity: card.color_identity }).eq('id', card.id),
      ),
    );
  }

  return next;
}

export async function deleteMtgCard(id: string): Promise<void> {
  const { data, error } = await supabase.from('mtg_cards').delete().eq('id', id).select('id');
  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new Error('Only the person who added this card, or an admin, can remove it.');
    }
    throw error;
  }
  if (!data?.length) {
    throw new Error('Only the person who added this card, or an admin, can remove it.');
  }
}
