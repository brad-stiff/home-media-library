const SLEEVE_URL =
  /^https:\/\/[^/\s]+\/storage\/v1\/object\/public\/deck-sleeves\/[0-9a-f-]{36}\/[0-9a-f-]{36}\?t=\d+$/i;

/** Public sleeve photo URL this app stores after an upload. */
export function isDeckSleeveImageUrl(value: string): boolean {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base || value.length > 500 || !value.startsWith(`${base}/`)) return false;
  return SLEEVE_URL.test(value);
}

export function partitionDecks<T extends { archivedAt: string | null }>(
  decks: T[],
): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];
  for (const deck of decks) {
    if (deck.archivedAt) archived.push(deck);
    else active.push(deck);
  }
  return { active, archived };
}
