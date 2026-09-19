export type BookLookupResult = {
  isbn: string;
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

function coverFromIsbn(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
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
