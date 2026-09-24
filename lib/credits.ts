export type ApiProvider = 'tmdb' | 'openLibrary' | 'scryfall' | 'archidekt';

export const API_CREDITS: { id: ApiProvider; name: string; notice: string }[] = [
  {
    id: 'tmdb',
    name: 'TMDb',
    notice:
      'Movie data from TMDb. This product uses the TMDb API but is not endorsed or certified by TMDb.',
  },
  {
    id: 'openLibrary',
    name: 'Open Library',
    notice: 'Book data from Open Library.',
  },
  {
    id: 'scryfall',
    name: 'Scryfall',
    notice: 'Card data from Scryfall.',
  },
  {
    id: 'archidekt',
    name: 'Archidekt',
    notice: 'Deck lists imported from Archidekt. Cards resolve through Scryfall.',
  },
];

export function creditNotice(provider: ApiProvider): string {
  return API_CREDITS.find((entry) => entry.id === provider)?.notice ?? '';
}
