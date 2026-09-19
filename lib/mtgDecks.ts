import { ArchidektImportResult } from './archidekt';
import { getMyHousehold } from './household';
import { supabase } from './supabase';

export type MtgDeck = {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  archidektId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MtgDeckCard = {
  id: string;
  deckId: string;
  scryfallId: string;
  oracleId: string | null;
  name: string;
  imageUri: string | null;
  manaCost: string | null;
  typeLine: string | null;
  qty: number;
  category: string;
  isCommander: boolean;
};

type DeckRow = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  archidekt_id: string | null;
  created_at: string;
  updated_at: string;
};

type DeckCardRow = {
  id: string;
  deck_id: string;
  scryfall_id: string;
  oracle_id: string | null;
  name: string;
  image_uri: string | null;
  mana_cost: string | null;
  type_line: string | null;
  qty: number;
  category: string;
  is_commander: boolean;
};

function rowToDeck(row: DeckRow): MtgDeck {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    description: row.description,
    archidektId: row.archidekt_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDeckCard(row: DeckCardRow): MtgDeckCard {
  return {
    id: row.id,
    deckId: row.deck_id,
    scryfallId: row.scryfall_id,
    oracleId: row.oracle_id,
    name: row.name,
    imageUri: row.image_uri,
    manaCost: row.mana_cost,
    typeLine: row.type_line,
    qty: row.qty,
    category: row.category,
    isCommander: row.is_commander,
  };
}

export async function listMtgDecks(): Promise<MtgDeck[]> {
  const { data, error } = await supabase
    .from('mtg_decks')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data as DeckRow[]) ?? []).map(rowToDeck);
}

export async function getMtgDeck(id: string): Promise<MtgDeck | null> {
  const { data, error } = await supabase.from('mtg_decks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToDeck(data as DeckRow) : null;
}

export async function getMtgDeckCards(deckId: string): Promise<MtgDeckCard[]> {
  const { data, error } = await supabase
    .from('mtg_deck_cards')
    .select('*')
    .eq('deck_id', deckId)
    .order('is_commander', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data as DeckCardRow[]) ?? []).map(rowToDeckCard);
}

export async function createMtgDeck(name: string, description?: string): Promise<MtgDeck> {
  const household = await getMyHousehold();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('mtg_decks')
    .insert({
      household_id: household.householdId,
      name: name.trim(),
      description: description?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToDeck(data as DeckRow);
}

export async function deleteMtgDeck(id: string): Promise<void> {
  const { error } = await supabase.from('mtg_decks').delete().eq('id', id);
  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new Error('Only household admins can delete decks.');
    }
    throw error;
  }
}

export async function importArchidektDeck(imported: ArchidektImportResult): Promise<MtgDeck> {
  const household = await getMyHousehold();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deck, error: deckError } = await supabase
    .from('mtg_decks')
    .insert({
      household_id: household.householdId,
      name: imported.name,
      archidekt_id: imported.archidektId,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (deckError) throw deckError;

  const rows = imported.cards.map((card) => ({
    deck_id: (deck as DeckRow).id,
    scryfall_id: card.scryfallId,
    oracle_id: card.oracleId,
    name: card.name,
    image_uri: card.imageUri,
    mana_cost: card.manaCost,
    type_line: card.typeLine,
    qty: card.qty,
    category: card.category,
    is_commander: card.isCommander,
  }));

  // Insert in chunks to avoid payload limits
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from('mtg_deck_cards').insert(chunk);
    if (error) throw error;
  }

  return rowToDeck(deck as DeckRow);
}
