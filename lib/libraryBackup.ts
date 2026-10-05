import { getMyHousehold } from './household';
import { pageAll } from './pageAll';
import { supabase } from './supabase';

type HouseholdTable = 'movies' | 'books' | 'mtg_cards' | 'mtg_decks' | 'checkouts' | 'contacts';

export type LibraryBackup = {
  version: 1;
  exportedAt: string;
  household: { id: string; name: string };
  movies: unknown[];
  books: unknown[];
  mtgCards: unknown[];
  mtgDecks: (Record<string, unknown> & { cards: unknown[] })[];
  checkouts: unknown[];
  contacts: unknown[];
};

async function selectAll(table: HouseholdTable, householdId: string): Promise<unknown[]> {
  return pageAll((from, to) =>
    supabase
      .from(table)
      .select('*')
      .eq('household_id', householdId)
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/** JSON backup of the tables that exist today. Games and Pokémon fields arrive with later phases. */
export async function buildLibraryBackup(): Promise<LibraryBackup> {
  const household = await getMyHousehold();
  const [movies, books, mtgCards, decks, checkouts, contacts] = await Promise.all([
    selectAll('movies', household.householdId),
    selectAll('books', household.householdId),
    selectAll('mtg_cards', household.householdId),
    selectAll('mtg_decks', household.householdId),
    selectAll('checkouts', household.householdId),
    selectAll('contacts', household.householdId),
  ]);

  const mtgDecks = await Promise.all(
    (decks as { id: string }[]).map(async (deck) => {
      const cards = await pageAll((from, to) =>
        supabase
          .from('mtg_deck_cards')
          .select('*')
          .eq('deck_id', deck.id)
          .order('id', { ascending: true })
          .range(from, to),
      );
      return { ...deck, cards };
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
    contacts,
  };
}
