import { describe, expect, it } from 'vitest';

import {
  defaultLibraryView,
  moveDockTab,
  parseLibraryView,
  resolveOpeningTab,
  sortCatalog,
  sortDecks,
  visibleDockTabs,
  type DockType,
  type LibraryViewPrefs,
} from './libraryView';

const shipped = (type: DockType) => type === 'movies' || type === 'books' || type === 'mtg';

describe('parseLibraryView', () => {
  it('fills defaults for an empty profile', () => {
    expect(parseLibraryView({})).toEqual(defaultLibraryView());
    expect(parseLibraryView(null).opening).toBe('resume');
  });

  it('keeps a valid partial preference and drops junk', () => {
    const parsed = parseLibraryView({
      opening: 'books',
      lastTab: 'movies',
      density: 'compact',
      dockOrder: ['mtg', 'movies', 'mtg', 'nope'],
      movies: { layout: 'list', sort: 'year', availability: 'out' },
      decks: { sort: 'added' },
    });
    expect(parsed.opening).toBe('books');
    expect(parsed.lastTab).toBe('movies');
    expect(parsed.density).toBe('compact');
    expect(parsed.dockOrder).toEqual(['mtg', 'movies', 'books', 'games', 'pokemon']);
    expect(parsed.movies).toEqual({ layout: 'list', sort: 'year', availability: 'out' });
    expect(parsed.books.layout).toBe('grid');
    expect(parsed.decks.sort).toBe('added');
  });
});

describe('dock order', () => {
  const order: DockType[] = ['movies', 'books', 'games', 'mtg', 'pokemon'];

  it('shows only types the household and the user still allow', () => {
    const visible = visibleDockTabs(order, (type) => shipped(type) && type !== 'books');
    expect(visible).toEqual(['movies', 'mtg']);
  });

  it('reorders visible tabs without revealing a hidden type', () => {
    const visible = visibleDockTabs(order, shipped);
    const moved = moveDockTab(order, visible, 'mtg', -1);
    expect(moved).toEqual(['movies', 'mtg', 'games', 'books', 'pokemon']);
    expect(visibleDockTabs(moved, shipped)).toEqual(['movies', 'mtg', 'books']);
  });

  it('leaves the order alone at the ends', () => {
    const visible = visibleDockTabs(order, shipped);
    expect(moveDockTab(order, visible, 'movies', -1)).toEqual(order);
    expect(moveDockTab(order, visible, 'mtg', 1)).toEqual(order);
  });
});

describe('resolveOpeningTab', () => {
  const visible: DockType[] = ['books', 'mtg'];

  function prefs(patch: Partial<LibraryViewPrefs>): LibraryViewPrefs {
    return { ...defaultLibraryView(), ...patch };
  }

  it('resumes the last visible tab', () => {
    expect(resolveOpeningTab(prefs({ opening: 'resume', lastTab: 'mtg' }), visible)).toBe('mtg');
  });

  it('uses a chosen tab when that tab is still visible', () => {
    expect(resolveOpeningTab(prefs({ opening: 'books', lastTab: 'mtg' }), visible)).toBe('books');
  });

  it('falls back to the first dock tab when the saved tab is hidden', () => {
    expect(resolveOpeningTab(prefs({ opening: 'movies', lastTab: 'movies' }), visible)).toBe('books');
    expect(resolveOpeningTab(prefs({ opening: 'resume', lastTab: 'games' }), visible)).toBe('books');
  });

  it('returns null when nothing is visible', () => {
    expect(resolveOpeningTab(defaultLibraryView(), [])).toBeNull();
  });
});

describe('sort', () => {
  const items = [
    { title: 'bravo', year: '1999', addedAt: '2020-01-01T00:00:00.000Z' },
    { title: 'Alpha', year: null, addedAt: '2024-01-01T00:00:00.000Z' },
    { title: 'charlie', year: '2021', addedAt: '2022-01-01T00:00:00.000Z' },
  ];
  const fields = {
    title: (item: (typeof items)[number]) => item.title,
    year: (item: (typeof items)[number]) => item.year,
    addedAt: (item: (typeof items)[number]) => item.addedAt,
  };

  it('sorts title A–Z without caring about case', () => {
    expect(sortCatalog(items, 'title', fields).map((item) => item.title)).toEqual([
      'Alpha',
      'bravo',
      'charlie',
    ]);
  });

  it('sorts year newest first and puts a missing year last', () => {
    expect(sortCatalog(items, 'year', fields).map((item) => item.title)).toEqual([
      'charlie',
      'bravo',
      'Alpha',
    ]);
  });

  it('sorts date added newest first, then title', () => {
    expect(sortCatalog(items, 'added', fields).map((item) => item.title)).toEqual([
      'Alpha',
      'charlie',
      'bravo',
    ]);
  });

  it('sorts decks by title or date added', () => {
    const decks = [
      { name: 'Zed', createdAt: '2024-01-01T00:00:00.000Z' },
      { name: 'Amy', createdAt: '2021-01-01T00:00:00.000Z' },
    ];
    const deckFields = { title: (deck: (typeof decks)[number]) => deck.name, addedAt: (deck: (typeof decks)[number]) => deck.createdAt };
    expect(sortDecks(decks, 'title', deckFields).map((deck) => deck.name)).toEqual(['Amy', 'Zed']);
    expect(sortDecks(decks, 'added', deckFields).map((deck) => deck.name)).toEqual(['Zed', 'Amy']);
  });
});
