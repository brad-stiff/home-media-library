import { ArchidektImportedCard, ArchidektImportResult } from './archidekt';
import {
  categoryForBoard,
  colorIdentityKey,
  DeckBoard,
  deckTileIdentity,
  DeckFormat,
  isDeckBoard,
  isDeckFormat,
} from './deckLegality';
import { FinishCounts, sumCommittedDeckCopies } from './deckUsage';
import { isDeckSleeveImageUrl } from './deckSleeve';
import { sleeveById } from './dragonShield';
import { Tables } from './database.types';
import { getMyHousehold } from './household';
import { pageAll } from './pageAll';
import {
  ScryfallCard,
  scryfallImageUri,
  scryfallOracleText,
  scryfallStandardLegality,
  scryfallTypeLine,
} from './scryfall';
import { supabase } from './supabase';

const EDIT_DENIED = 'Only the person who created this deck, or an admin, can edit it.';

export type MtgDeck = {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  format: DeckFormat;
  archidektId: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  sleeveId: string | null;
  sleeveImageUrl: string | null;
  archivedAt: string | null;
};

/** A deck plus the colors its tile shows. '' is colorless. Null means the colors are not known yet. */
export type MtgDeckListItem = MtgDeck & {
  colors: string | null;
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
  board: DeckBoard;
  foil: boolean;
  colorIdentity: string | null;
  oracleText: string | null;
  keywords: string[];
  standardLegality: string | null;
};

export type DeckCardDraft = {
  scryfallId: string;
  oracleId: string | null;
  name: string;
  imageUri: string | null;
  manaCost: string | null;
  typeLine: string | null;
  qty: number;
  board: DeckBoard;
  foil: boolean;
  colorIdentity: string | null;
  oracleText: string | null;
  keywords: string[];
  standardLegality: string | null;
};

type DeckRow = Tables<'mtg_decks'>;
type DeckCardRow = Tables<'mtg_deck_cards'>;

const BOARD_ORDER: Record<DeckBoard, number> = {
  commander: 0,
  main: 1,
  sideboard: 2,
  maybeboard: 3,
};

function rowToDeck(row: DeckRow): MtgDeck {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    description: row.description,
    format: isDeckFormat(row.format) ? row.format : 'commander',
    archidektId: row.archidekt_id,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sleeveId: row.sleeve_id,
    sleeveImageUrl: row.sleeve_image_url,
    archivedAt: row.archived_at,
  };
}

function rowToDeckCard(row: DeckCardRow): MtgDeckCard {
  const board: DeckBoard = isDeckBoard(row.board)
    ? row.board
    : row.is_commander
      ? 'commander'
      : 'main';
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
    isCommander: board === 'commander',
    board,
    foil: !!row.foil,
    colorIdentity: row.color_identity,
    oracleText: row.oracle_text,
    keywords: row.keywords ?? [],
    standardLegality: row.standard_legality,
  };
}

function throwDeckEdit(error: { code?: string; message?: string }): never {
  if (error.code === '42501' || (error.message ?? '').toLowerCase().includes('policy')) {
    throw new Error(EDIT_DENIED);
  }
  throw error;
}

function draftFromImported(card: ArchidektImportedCard): DeckCardDraft {
  return {
    scryfallId: card.scryfallId,
    oracleId: card.oracleId,
    name: card.name,
    imageUri: card.imageUri,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    qty: card.qty,
    board: card.board,
    foil: card.foil,
    colorIdentity: card.colorIdentity,
    oracleText: card.oracleText,
    keywords: card.keywords,
    standardLegality: card.standardLegality,
  };
}

export function draftFromScryfall(card: ScryfallCard, options: { board: DeckBoard; foil: boolean; qty?: number }): DeckCardDraft {
  return {
    scryfallId: card.id,
    oracleId: card.oracle_id ?? null,
    name: card.name,
    imageUri: scryfallImageUri(card, 'normal'),
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
    typeLine: scryfallTypeLine(card),
    qty: options.qty && options.qty > 0 ? options.qty : 1,
    board: options.board,
    foil: options.foil,
    colorIdentity: colorIdentityKey(card.color_identity),
    oracleText: scryfallOracleText(card),
    keywords: card.keywords ?? [],
    standardLegality: scryfallStandardLegality(card),
  };
}

function draftRow(deckId: string, card: DeckCardDraft) {
  const qty = card.qty > 0 ? card.qty : 1;
  return {
    deck_id: deckId,
    scryfall_id: card.scryfallId,
    oracle_id: card.oracleId,
    name: card.name,
    image_uri: card.imageUri,
    mana_cost: card.manaCost,
    type_line: card.typeLine,
    qty,
    category: categoryForBoard(card.board),
    is_commander: card.board === 'commander',
    board: card.board,
    foil: card.foil,
    color_identity: card.colorIdentity,
    oracle_text: card.oracleText,
    keywords: card.keywords,
    standard_legality: card.standardLegality,
  };
}

async function insertDrafts(deckId: string, cards: DeckCardDraft[]): Promise<void> {
  const rows = cards.map((card) => draftRow(deckId, card));
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from('mtg_deck_cards').insert(chunk);
    if (error) throwDeckEdit(error);
  }
}

export function withScryfallRules(card: MtgDeckCard, scry: ScryfallCard | undefined): MtgDeckCard {
  if (!scry) return { ...card, oracleText: card.oracleText ?? '' };
  return {
    ...card,
    typeLine: scryfallTypeLine(scry) ?? card.typeLine,
    colorIdentity: colorIdentityKey(scry.color_identity),
    oracleText: scryfallOracleText(scry),
    keywords: scry.keywords ?? [],
    standardLegality: scryfallStandardLegality(scry),
    manaCost: card.manaCost ?? scry.mana_cost ?? scry.card_faces?.[0]?.mana_cost ?? null,
    imageUri: card.imageUri ?? scryfallImageUri(scry, 'normal'),
  };
}

export async function listMtgDecks(): Promise<MtgDeck[]> {
  const rows = await pageAll((from, to) =>
    supabase
      .from('mtg_decks')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows.map(rowToDeck);
}

export async function listMtgDeckTiles(): Promise<MtgDeckListItem[]> {
  const decks = await listMtgDecks();
  const rows = await pageAll((from, to) =>
    supabase
      .from('mtg_deck_cards')
      .select('id, deck_id, board, color_identity')
      .order('id', { ascending: true })
      .range(from, to),
  );
  const byDeck = new Map<string, { board: DeckBoard; colorIdentity: string | null }[]>();
  for (const row of rows) {
    if (!isDeckBoard(row.board)) continue;
    const cards = byDeck.get(row.deck_id) ?? [];
    cards.push({ board: row.board, colorIdentity: row.color_identity });
    byDeck.set(row.deck_id, cards);
  }
  return decks.map((deck) => ({
    ...deck,
    colors: deckTileIdentity(deck.format, byDeck.get(deck.id) ?? []),
  }));
}

/** How many copies of this printing sit in active decks, split by finish. */
export async function getPrintingDeckUsage(scryfallId: string): Promise<FinishCounts> {
  const [decks, cards] = await Promise.all([
    pageAll((from, to) =>
      supabase
        .from('mtg_decks')
        .select('id')
        .is('archived_at', null)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    pageAll((from, to) =>
      supabase
        .from('mtg_deck_cards')
        .select('id, deck_id, qty, foil, board')
        .eq('scryfall_id', scryfallId)
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);

  return sumCommittedDeckCopies(
    cards.map((card) => ({
      deckId: card.deck_id,
      qty: card.qty,
      foil: card.foil,
      board: card.board,
    })),
    new Set(decks.map((deck) => deck.id)),
  );
}

export async function getMtgDeck(id: string): Promise<MtgDeck | null> {
  const { data, error } = await supabase.from('mtg_decks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToDeck(data) : null;
}

export async function getMtgDeckCards(deckId: string): Promise<MtgDeckCard[]> {
  const rows = await pageAll((from, to) =>
    supabase
      .from('mtg_deck_cards')
      .select('*')
      .eq('deck_id', deckId)
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows
    .map(rowToDeckCard)
    .sort((a, b) => BOARD_ORDER[a.board] - BOARD_ORDER[b.board] || a.name.localeCompare(b.name));
}

export async function createMtgDeck(name: string, format: DeckFormat, description?: string): Promise<MtgDeck> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a deck name.');
  const household = await getMyHousehold();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('mtg_decks')
    .insert({
      household_id: household.householdId,
      name: trimmed,
      description: description?.trim() || null,
      format,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToDeck(data as DeckRow);
}

export async function updateMtgDeck(
  id: string,
  patch: {
    name?: string;
    format?: DeckFormat;
    sleeveId?: string | null;
    sleeveImageUrl?: string | null;
    archived?: boolean;
  },
): Promise<void> {
  const row: {
    name?: string;
    format?: DeckFormat;
    sleeve_id?: string | null;
    sleeve_image_url?: string | null;
    archived_at?: string | null;
  } = {};
  if (patch.name != null) {
    const name = patch.name.trim();
    if (!name) throw new Error('Enter a deck name.');
    row.name = name;
  }
  if (patch.format) row.format = patch.format;
  if (patch.sleeveId !== undefined) {
    if (patch.sleeveId != null && !sleeveById(patch.sleeveId)) {
      throw new Error('Choose a Dragon Shield sleeve color.');
    }
    row.sleeve_id = patch.sleeveId;
  }
  if (patch.sleeveImageUrl !== undefined) {
    if (patch.sleeveImageUrl != null && !isDeckSleeveImageUrl(patch.sleeveImageUrl)) {
      throw new Error('Could not save the sleeve photo.');
    }
    row.sleeve_image_url = patch.sleeveImageUrl;
  }
  if (patch.archived != null) {
    row.archived_at = patch.archived ? new Date().toISOString() : null;
  }
  if (Object.keys(row).length === 0) return;

  const { data, error } = await supabase.from('mtg_decks').update(row).eq('id', id).select('id');
  if (error) throwDeckEdit(error);
  if (!data?.length) throw new Error(EDIT_DENIED);
}

export async function deleteMtgDeck(id: string): Promise<void> {
  const { data, error } = await supabase.from('mtg_decks').delete().eq('id', id).select('id');
  if (error) throwDeckEdit(error);
  if (!data?.length) throw new Error(EDIT_DENIED);
}

export async function addCardToDeck(deckId: string, draft: DeckCardDraft): Promise<void> {
  const qty = draft.qty > 0 ? draft.qty : 1;
  const { data: existing, error: lookupError } = await supabase
    .from('mtg_deck_cards')
    .select('*')
    .eq('deck_id', deckId)
    .eq('scryfall_id', draft.scryfallId)
    .eq('board', draft.board)
    .eq('foil', draft.foil)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    const row = existing as DeckCardRow;
    const { data, error } = await supabase
      .from('mtg_deck_cards')
      .update({
        qty: row.qty + qty,
        oracle_text: row.oracle_text ?? draft.oracleText,
        keywords: row.keywords?.length ? row.keywords : draft.keywords,
        color_identity: row.color_identity ?? draft.colorIdentity,
        standard_legality: row.standard_legality ?? draft.standardLegality,
        type_line: row.type_line ?? draft.typeLine,
      })
      .eq('id', row.id)
      .select('id');
    if (error) throwDeckEdit(error);
    if (!data?.length) throw new Error(EDIT_DENIED);
    return;
  }

  const { error } = await supabase.from('mtg_deck_cards').insert(draftRow(deckId, { ...draft, qty }));
  if (error) throwDeckEdit(error);
}

export async function updateDeckCardQty(id: string, qty: number): Promise<void> {
  if (qty < 1) {
    await removeDeckCard(id);
    return;
  }
  const { data, error } = await supabase.from('mtg_deck_cards').update({ qty }).eq('id', id).select('id');
  if (error) throwDeckEdit(error);
  if (!data?.length) throw new Error(EDIT_DENIED);
}

export async function removeDeckCard(id: string): Promise<void> {
  const { data, error } = await supabase.from('mtg_deck_cards').delete().eq('id', id).select('id');
  if (error) throwDeckEdit(error);
  if (!data?.length) throw new Error(EDIT_DENIED);
}

export async function moveDeckCard(card: MtgDeckCard, board: DeckBoard): Promise<void> {
  if (card.board === board) return;

  const { data: existing, error: lookupError } = await supabase
    .from('mtg_deck_cards')
    .select('*')
    .eq('deck_id', card.deckId)
    .eq('scryfall_id', card.scryfallId)
    .eq('board', board)
    .eq('foil', card.foil)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing && (existing as DeckCardRow).id !== card.id) {
    const row = existing as DeckCardRow;
    const { data, error } = await supabase
      .from('mtg_deck_cards')
      .update({ qty: row.qty + card.qty })
      .eq('id', row.id)
      .select('id');
    if (error) throwDeckEdit(error);
    if (!data?.length) throw new Error(EDIT_DENIED);
    await removeDeckCard(card.id);
    return;
  }

  const { data, error } = await supabase
    .from('mtg_deck_cards')
    .update({
      board,
      category: categoryForBoard(board),
      is_commander: board === 'commander',
    })
    .eq('id', card.id)
    .select('id');
  if (error) throwDeckEdit(error);
  if (!data?.length) throw new Error(EDIT_DENIED);
}

export async function saveDeckCardRules(card: MtgDeckCard): Promise<void> {
  const { error } = await supabase
    .from('mtg_deck_cards')
    .update({
      oracle_text: card.oracleText,
      keywords: card.keywords,
      color_identity: card.colorIdentity,
      standard_legality: card.standardLegality,
      type_line: card.typeLine,
    })
    .eq('id', card.id);
  if (error) throwDeckEdit(error);
}

export async function importArchidektDeck(imported: ArchidektImportResult, format: DeckFormat): Promise<MtgDeck> {
  const household = await getMyHousehold();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deck, error: deckError } = await supabase
    .from('mtg_decks')
    .insert({
      household_id: household.householdId,
      name: imported.name,
      format,
      archidekt_id: imported.archidektId,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (deckError) throw deckError;

  await insertDrafts((deck as DeckRow).id, imported.cards.map(draftFromImported));
  return rowToDeck(deck as DeckRow);
}

/** Replaces the card list. Local qty, board, and commander edits are overwritten. */
export async function resyncArchidektDeck(
  deckId: string,
  imported: ArchidektImportResult,
  format: DeckFormat,
): Promise<void> {
  await updateMtgDeck(deckId, { format });
  const existing = await getMtgDeckCards(deckId);
  if (existing.length > 0) {
    const { data, error } = await supabase.from('mtg_deck_cards').delete().eq('deck_id', deckId).select('id');
    if (error) throwDeckEdit(error);
    if (!data || data.length < existing.length) throw new Error(EDIT_DENIED);
  }
  await insertDrafts(deckId, imported.cards.map(draftFromImported));
}
