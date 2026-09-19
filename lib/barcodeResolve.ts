import {
  cleanProductTitleForSearch,
  isIsbn,
  normalizeBarcode,
  ownershipHintsFromProductTitle,
} from './barcode';
import { lookupBookByIsbn, BookLookupResult } from './openLibrary';
import { searchMovies } from './tmdb';
import { MovieOwnership, TmdbMovieSearchResult } from './types';
import { lookupUpcProduct } from './upc';

export type BarcodeResolveResult =
  | {
      kind: 'book';
      barcode: string;
      book: BookLookupResult;
    }
  | {
      kind: 'movie_candidates';
      barcode: string;
      productTitle: string;
      searchQuery: string;
      ownershipHints: Partial<MovieOwnership>;
      movies: TmdbMovieSearchResult[];
    }
  | {
      kind: 'unresolved';
      barcode: string;
      reason: string;
      suggestedQuery: string | null;
    };

export async function resolveBarcode(raw: string): Promise<BarcodeResolveResult> {
  const barcode = normalizeBarcode(raw);
  if (barcode.length < 8) {
    return {
      kind: 'unresolved',
      barcode,
      reason: 'Barcode looks too short.',
      suggestedQuery: null,
    };
  }

  if (isIsbn(barcode)) {
    try {
      const book = await lookupBookByIsbn(barcode);
      if (book) {
        return { kind: 'book', barcode, book };
      }
      return {
        kind: 'unresolved',
        barcode,
        reason: 'No book found for that ISBN.',
        suggestedQuery: null,
      };
    } catch {
      return {
        kind: 'unresolved',
        barcode,
        reason: 'Could not reach Open Library. Try again or search manually.',
        suggestedQuery: null,
      };
    }
  }

  try {
    const product = await lookupUpcProduct(barcode);
    if (!product) {
      return {
        kind: 'unresolved',
        barcode,
        reason: 'No product found for that barcode.',
        suggestedQuery: null,
      };
    }

    const searchQuery = cleanProductTitleForSearch(product.title);
    const ownershipHints = ownershipHintsFromProductTitle(product.title);
    const movies = searchQuery ? await searchMovies(searchQuery) : [];

    if (movies.length === 0) {
      return {
        kind: 'unresolved',
        barcode,
        reason: `Found “${product.title}” but no TMDb match.`,
        suggestedQuery: searchQuery || product.title,
      };
    }

    return {
      kind: 'movie_candidates',
      barcode,
      productTitle: product.title,
      searchQuery,
      ownershipHints,
      movies,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UPC lookup failed.';
    return {
      kind: 'unresolved',
      barcode,
      reason: message,
      suggestedQuery: null,
    };
  }
}
