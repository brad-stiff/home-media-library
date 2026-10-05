/** PostgREST's default max-rows. A shorter page means the query is finished. */
export const POSTGREST_PAGE_SIZE = 1000;

/** `.in()` filters go in the URL, so keep each list short and under the row cap. */
export const IN_FILTER_CHUNK = 200;

type Page<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Reads every row by asking for `range` pages.
 * The query must order by a unique column, or a later page can skip or repeat rows.
 */
export async function pageAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + POSTGREST_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < POSTGREST_PAGE_SIZE) return rows;
    from += POSTGREST_PAGE_SIZE;
  }
}

export async function mapInChunks<T>(
  ids: readonly string[],
  fetchChunk: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += IN_FILTER_CHUNK) {
    rows.push(...(await fetchChunk(ids.slice(index, index + IN_FILTER_CHUNK))));
  }
  return rows;
}
