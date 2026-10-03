import { describe, expect, it } from 'vitest';

import { extractArchidektId } from './archidekt';
import {
  cleanProductTitleForSearch,
  isIsbn,
  isLikelyProductUpc,
  normalizeBarcode,
  ownershipHintsFromProductTitle,
} from './barcode';
import { checkoutStatus } from './checkoutStatus';
import { backdropUrl, extractYear, formatRuntime, posterUrl } from './mediaFormat';
import { bookSearchSubtitle } from './openLibrary';
import { scryfallImageUri } from './scryfall';
import { movieSearchSubtitle } from './tmdb';
import { formatOwnershipLabel } from './types';

describe('barcodes', () => {
  it('keeps digits only', () => {
    expect(normalizeBarcode('978-0-306-40615-7')).toBe('9780306406157');
  });

  it('treats ISBN-10 and 978/979 ISBN-13 as books', () => {
    expect(isIsbn('0306406152')).toBe(true);
    expect(isIsbn('9780306406157')).toBe(true);
    expect(isIsbn('9791234567890')).toBe(true);
    expect(isIsbn('012345678905')).toBe(false);
    expect(isIsbn('9771234567890')).toBe(false);
  });

  it('treats 8, 12, and 13 digit codes as product UPCs', () => {
    expect(isLikelyProductUpc('12345678')).toBe(true);
    expect(isLikelyProductUpc('012345678905')).toBe(true);
    expect(isLikelyProductUpc('9780306406157')).toBe(true);
    expect(isLikelyProductUpc('0306406152')).toBe(false);
  });

  it('strips retail format noise from a search title', () => {
    expect(cleanProductTitleForSearch('Dune [4K UHD] (Steelbook) Collector\'s Edition')).toBe('Dune');
    expect(cleanProductTitleForSearch('Alien Blu-ray')).toBe('Alien');
  });

  it('reads format hints from the original product title', () => {
    expect(ownershipHintsFromProductTitle('Dune 4K UHD + Blu-ray + Digital')).toEqual({
      has4k: true,
      hasBluray: true,
      hasDigital: true,
    });
    expect(ownershipHintsFromProductTitle('Dune')).toEqual({});
  });
});

describe('catalog formatters', () => {
  it('labels movie ownership', () => {
    expect(
      formatOwnershipLabel({
        hasBluray: true,
        has4k: true,
        hasDigital: false,
        platform: '  Vudu ',
      }),
    ).toBe('Blu-ray · 4K · Vudu');
    expect(
      formatOwnershipLabel({
        hasBluray: false,
        has4k: false,
        hasDigital: false,
        platform: '  ',
      }),
    ).toBe('Owned');
  });

  it('builds TMDb image URLs and release years', () => {
    expect(posterUrl(null)).toBeNull();
    expect(posterUrl('/dune.jpg')).toBe('https://image.tmdb.org/t/p/w500/dune.jpg');
    expect(posterUrl('/dune.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/dune.jpg');
    expect(backdropUrl('/wide.jpg')).toBe('https://image.tmdb.org/t/p/w780/wide.jpg');
    expect(extractYear('2021-10-22')).toBe('2021');
    expect(extractYear(null)).toBeNull();
    expect(extractYear('')).toBeNull();
  });

  it('formats runtime', () => {
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(120)).toBe('2h');
    expect(formatRuntime(95)).toBe('1h 35m');
  });

  it('subtitles a movie search hit with its year', () => {
    expect(
      movieSearchSubtitle({
        id: 1,
        title: 'Dune',
        release_date: '2021-10-22',
        poster_path: null,
        overview: '',
      }),
    ).toBe('2021');
    expect(
      movieSearchSubtitle({
        id: 1,
        title: 'Dune',
        release_date: '',
        poster_path: null,
        overview: '',
      }),
    ).toBe('Unknown year');
  });

  it('subtitles a book search hit with author and year', () => {
    expect(
      bookSearchSubtitle({
        isbn: null,
        title: 'Dune',
        authors: ['Frank Herbert'],
        year: '1965',
        coverUrl: null,
        overview: null,
        openLibraryKey: null,
      }),
    ).toBe('Frank Herbert · 1965');
    expect(
      bookSearchSubtitle({
        isbn: null,
        title: 'Unknown',
        authors: [],
        year: null,
        coverUrl: null,
        overview: null,
        openLibraryKey: null,
      }),
    ).toBe('Unknown author');
  });
});

describe('Archidekt ids', () => {
  it('accepts a numeric id or a deck URL', () => {
    expect(extractArchidektId('  48291 ')).toBe('48291');
    expect(extractArchidektId('https://archidekt.com/decks/48291')).toBe('48291');
    expect(extractArchidektId('https://www.archidekt.com/decks/48291/my-deck')).toBe('48291');
  });

  it('rejects anything that is not an id or an Archidekt deck URL', () => {
    expect(extractArchidektId('')).toBeNull();
    expect(extractArchidektId('my commander deck')).toBeNull();
    expect(extractArchidektId('https://example.com/decks/48291')).toBeNull();
  });
});

describe('Scryfall images', () => {
  it('prefers the requested size, then the card face', () => {
    expect(
      scryfallImageUri({
        id: '1',
        name: 'Xu-Ifit',
        image_uris: { normal: 'https://cards.example/normal.jpg' },
      }),
    ).toBe('https://cards.example/normal.jpg');

    expect(
      scryfallImageUri(
        {
          id: '2',
          name: 'Split',
          card_faces: [{ image_uris: { small: 'https://cards.example/face.jpg', normal: 'https://cards.example/face-n.jpg' } }],
        },
        'small',
      ),
    ).toBe('https://cards.example/face.jpg');

    expect(scryfallImageUri({ id: '3', name: 'No art' })).toBeNull();
  });
});

describe('checkoutStatus', () => {
  it('treats cancel as distinct from return, and cancel wins if both are set', () => {
    expect(checkoutStatus({ returnedAt: null, cancelledAt: null })).toBe('active');
    expect(checkoutStatus({ returnedAt: '2026-01-01', cancelledAt: null })).toBe('returned');
    expect(checkoutStatus({ returnedAt: null, cancelledAt: '2026-01-01' })).toBe('cancelled');
    expect(checkoutStatus({ returnedAt: '2026-01-01', cancelledAt: '2026-01-02' })).toBe('cancelled');
  });
});
