import { getMyHousehold } from './household';
import { supabase } from './supabase';

export type LibraryBackup = {
  version: 1;
  exportedAt: string;
  household: { id: string; name: string };
  movies: unknown[];
  books: unknown[];
  mtgCards: unknown[];
  mtgDecks: (Record<string, unknown> & { cards: unknown[] })[];
  checkouts: unknown[];
};

async function selectAll(table: string, householdId: string): Promise<unknown[]> {
  const { data, error } = await supabase.from(table).select('*').eq('household_id', householdId);
  if (error) throw error;
  return data ?? [];
}

/** JSON backup of the tables that exist today. Games and Pokémon fields arrive with later phases. */
export async function buildLibraryBackup(): Promise<LibraryBackup> {
  const household = await getMyHousehold();
  const [movies, books, mtgCards, decks, checkouts] = await Promise.all([
    selectAll('movies', household.householdId),
    selectAll('books', household.householdId),
    selectAll('mtg_cards', household.householdId),
    selectAll('mtg_decks', household.householdId),
    selectAll('checkouts', household.householdId),
  ]);

  const mtgDecks = await Promise.all(
    (decks as { id: string }[]).map(async (deck) => {
      const { data, error } = await supabase
        .from('mtg_deck_cards')
        .select('*')
        .eq('deck_id', deck.id);
      if (error) throw error;
      return { ...deck, cards: data ?? [] };
    }),
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    household: { id: household.householdId, name: household.name },
    movies,
    books,
    mtgCards,
    mtgDecks,
    checkouts,
  };
}
