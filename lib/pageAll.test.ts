import { describe, expect, it } from 'vitest';

import { IN_FILTER_CHUNK, mapInChunks, pageAll, POSTGREST_PAGE_SIZE } from './pageAll';

describe('pageAll', () => {
  it('keeps asking until a page comes back short', async () => {
    const calls: Array<[number, number]> = [];
    const rows = await pageAll<number>((from, to) => {
      calls.push([from, to]);
      if (from === 0) {
        return Promise.resolve({
          data: Array.from({ length: POSTGREST_PAGE_SIZE }, (_, index) => index),
          error: null,
        });
      }
      return Promise.resolve({ data: [POSTGREST_PAGE_SIZE], error: null });
    });

    expect(calls).toEqual([
      [0, POSTGREST_PAGE_SIZE - 1],
      [POSTGREST_PAGE_SIZE, POSTGREST_PAGE_SIZE * 2 - 1],
    ]);
    expect(rows).toHaveLength(POSTGREST_PAGE_SIZE + 1);
    expect(rows.at(-1)).toBe(POSTGREST_PAGE_SIZE);
  });

  it('returns an empty list when the first page is empty', async () => {
    const rows = await pageAll(() => Promise.resolve({ data: [], error: null }));
    expect(rows).toEqual([]);
  });

  it('throws the page error instead of returning a partial list', async () => {
    await expect(
      pageAll(() => Promise.resolve({ data: null, error: { message: 'nope' } })),
    ).rejects.toEqual({ message: 'nope' });
  });
});

describe('mapInChunks', () => {
  it('splits an id list so each request stays under the filter cap', async () => {
    const ids = Array.from({ length: IN_FILTER_CHUNK + 3 }, (_, index) => String(index));
    const seen: string[][] = [];
    const rows = await mapInChunks(ids, async (chunk) => {
      seen.push(chunk);
      return chunk.map((id) => Number(id));
    });

    expect(seen.map((chunk) => chunk.length)).toEqual([IN_FILTER_CHUNK, 3]);
    expect(rows).toHaveLength(ids.length);
  });
});
