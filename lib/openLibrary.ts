export type BookLookupResult = {
  isbn: string | null;
  title: string;
  authors: string[];
  year: string | null;
  coverUrl: string | null;
  overview: string | null;
  openLibraryKey: string | null;
};

type OpenLibraryEdition = {
  title?: string;
  publish_date?: string;
  key?: string;
  description?: string | { value?: string };
  cover?: { small?: string; medium?: string; large?: string };
  authors?: { name?: string }[];
};

type OpenLibrarySearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
};

function coverFromIsbn(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

function coverFromCoverId(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

function extractYear(publishDate?: string): string | null {
  if (!publishDate) return null;
  const match = publishDate.match(/\d{4}/);
  return match?.[0] ?? null;
}

function extractDescription(description?: string | { value?: string }): string | null {
  if (!description) return null;
  if (typeof description === 'string') return description;
  return description.value ?? null;
}

function pickIsbn(isbns?: string[]): string | null {
  if (!isbns?.length) return null;

  const digitsList = isbns
    .map((value) => value.replace(/\D/g, ''))
    .filter((digits) => digits.length === 10 || digits.length === 13);

  const isbn13 = digitsList.find((digits) => digits.length === 13);
  if (isbn13) return isbn13;

  return digitsList[0] ?? null;
}

export async function lookupBookByIsbn(isbn: string): Promise<BookLookupResult | null> {
  const digits = isbn.replace(/\D/g, '');
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${digits}&format=json&jscmd=data`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library request failed (${response.status})`);
  }

  const data = (await response.json()) as Record<string, OpenLibraryEdition>;
  const entry = data[`ISBN:${digits}`];
  if (!entry?.title) {
    return null;
  }

  const authors =
    entry.authors?.map((a) => a.name).filter((name): name is string => Boolean(name)) ?? [];

  return {
    isbn: digits,
    title: entry.title,
    authors,
    year: extractYear(entry.publish_date),
    coverUrl: entry.cover?.large ?? entry.cover?.medium ?? coverFromIsbn(digits),
    overview: extractDescription(entry.description),
    openLibraryKey: entry.key ?? null,
  };
}

export async function searchBooks(query: string): Promise<BookLookupResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', '20');
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,isbn');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open Library search failed (${response.status})`);
  }

  const data = (await response.json()) as { docs?: OpenLibrarySearchDoc[] };
  const docs = data.docs ?? [];

  return docs
    .filter((doc): doc is OpenLibrarySearchDoc & { title: string } => Boolean(doc.title))
    .map((doc) => {
      const isbn = pickIsbn(doc.isbn);
      return {
        isbn,
        title: doc.title,
        authors: doc.author_name ?? [],
        year: doc.first_publish_year ? String(doc.first_publish_year) : null,
        coverUrl: doc.cover_i
          ? coverFromCoverId(doc.cover_i)
          : isbn
            ? coverFromIsbn(isbn)
            : null,
        overview: null,
        openLibraryKey: doc.key ?? null,
      };
    });
}

export function bookSearchSubtitle(book: BookLookupResult): string {
  const parts = [
    book.authors.length > 0 ? book.authors.join(', ') : null,
    book.year,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Unknown author';
}
