import { getMyHousehold } from './household';
import { ScryfallCard, scryfallDisplayName, scryfallImageUri } from './scryfall';
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
  addedBy: string | null;
  addedByName: string | null;
  addedAt: string;
};

type MtgCardRow = {
  id: string;
  household_id: string;
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  set_code: string | null;
  set_name: string | null;
  collector_number: string | null;
  mana_cost: string | null;
  type_line: string | null;
  rarity: string | null;
  image_uri: string | null;
  qty: number;
  foil: boolean;
  added_by: string | null;
  added_by_name: string | null;
  created_at: string;
};

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
    addedBy: row.added_by,
    addedByName: row.added_by_name,
    addedAt: row.created_at,
  };
}

export async function getAllMtgCards(): Promise<MtgCard[]> {
  const { data, error } = await supabase
    .from('mtg_cards')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data as MtgCardRow[]) ?? []).map(rowToCard);
}

export async function searchMtgCollection(query: string): Promise<MtgCard[]> {
  const cards = await getAllMtgCards();
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return cards;
  return cards.filter((c) => {
    const haystack = [c.name, c.setCode ?? '', c.setName ?? '', c.typeLine ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(trimmed);
  });
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

  const { data: existing } = await supabase
    .from('mtg_cards')
    .select('*')
    .eq('household_id', household.householdId)
    .eq('scryfall_id', card.id)
    .eq('foil', foil)
    .maybeSingle();

  if (existing) {
    const row = existing as MtgCardRow;
    const { data, error } = await supabase
      .from('mtg_cards')
      .update({ qty: row.qty + qty })
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) {
      if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
        throw new Error('Only the person who added this card, or an admin, can change the quantity.');
      }
      throw error;
    }
    return rowToCard(data as MtgCardRow);
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
      added_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToCard(data as MtgCardRow);
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
