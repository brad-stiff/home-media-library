import { getMyHousehold } from './household';
import { BookLookupResult } from './openLibrary';
import { supabase } from './supabase';

export type Book = {
  id: string;
  householdId: string;
  isbn: string | null;
  title: string;
  authors: string[];
  year: string | null;
  coverUrl: string | null;
  overview: string | null;
  openLibraryKey: string | null;
  addedBy: string | null;
  addedAt: string;
  updatedAt: string;
};

type BookRow = {
  id: string;
  household_id: string;
  isbn: string | null;
  title: string;
  authors: string[] | null;
  year: string | null;
  cover_url: string | null;
  overview: string | null;
  open_library_key: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
};

function rowToBook(row: BookRow): Book {
  return {
    id: row.id,
    householdId: row.household_id,
    isbn: row.isbn,
    title: row.title,
    authors: row.authors ?? [],
    year: row.year,
    coverUrl: row.cover_url,
    overview: row.overview,
    openLibraryKey: row.open_library_key,
    addedBy: row.added_by,
    addedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('title', { ascending: true });

  if (error) throw error;
  return (data as BookRow[]).map(rowToBook);
}

export async function searchBooksInLibrary(query: string): Promise<Book[]> {
  const books = await getAllBooks();
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return books;

  return books.filter((book) => {
    const haystack = [book.title, book.year ?? '', book.isbn ?? '', ...book.authors]
      .join(' ')
      .toLowerCase();
    return haystack.includes(trimmed);
  });
}

export async function getBookById(id: string): Promise<Book | null> {
  const { data, error } = await supabase.from('books').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToBook(data as BookRow) : null;
}

export async function addBookFromLookup(lookup: BookLookupResult): Promise<Book> {
  const household = await getMyHousehold();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('books')
    .insert({
      household_id: household.householdId,
      isbn: lookup.isbn,
      title: lookup.title,
      authors: lookup.authors,
      year: lookup.year,
      cover_url: lookup.coverUrl,
      overview: lookup.overview,
      open_library_key: lookup.openLibraryKey,
      added_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This book is already in your library.');
    }
    throw error;
  }

  return rowToBook(data as BookRow);
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', id);
  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new Error('Only household admins can remove books.');
    }
    throw error;
  }
}
