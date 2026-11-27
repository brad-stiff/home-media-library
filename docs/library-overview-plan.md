# Books & movies overview — work plan

Status: **planned** (no implementation yet). Decisions below are locked from product discussion; open items are called out at the end.

## Goal

As movie and book libraries grow, the flat list gets overwhelming. Give **Movies** and **Books** the same kind of **overview → drill-in → all** landing the MTG collection already has, so browsing starts from a summary of meaningful buckets instead of every title at once.

Years stay a **sort** on title lists. They are **not** the overview’s primary buckets.

## Why not years

MTG’s overview works because **sets** are real collection units (completion, drill-in, checklist). Release/publication year is a weak analogue: many thin years, a few crowded ones, and it is not how people usually think about a household shelf. Year is already available as catalog sort (`title` | `year` | `added`) and should stay that way.

## Product decisions (locked)

| Topic | Decision |
| --- | --- |
| Scope | **Movies** and **Books** tabs only (MTG overview unchanged) |
| Pattern | Mirror MTG collection: **overview** → bucket list → **All** escape hatch, with header back to overview |
| Movies primary bucket | **Genre** (from TMDb genres already stored on each movie) |
| Books primary bucket | **Author** (from Open Library authors already stored on each book) |
| Years | Sort only — no year/decade tiles on the overview |
| Multi-value membership | A title appears in **every** matching bucket (same idea as MTG color identity matching more than one mana color) |
| Missing metadata | Empty author list or empty genres → a single **Unknown** bucket |
| Existing list UX | Grid/list layout, availability filter (when lending is on), and sort still apply on bucket and **All** screens |

## Proposed UX

### Shared shape (per tab)

1. Opening **Movies** or **Books** lands on an **overview** (not the full title grid).
2. Header shows light totals (e.g. title count · bucket count).
3. Overview is a scrollable grid/list of **bucket tiles** (genre or author) with a count.
4. Tap a tile → that bucket’s titles (current `MovieResults` / `BookResults`, filtered).
5. An **All movies** / **All books** control (like MTG **All cards**) opens the ungrouped library.
6. Search on overview filters **bucket names** (and optionally jumps into titles — see open items). Search on a bucket or **All** keeps today’s title search.
7. Leaving the tab resets to overview (same habit as MTG collection when switching away).

### Movies

- Overview tiles = distinct genres present in the household library.
- Drill-in shows movies that include that genre.
- Sort / layout / availability filters behave as they do today once inside a genre or **All**.

### Books

- Overview tiles = distinct authors present in the household library.
- Drill-in shows books that list that author.
- Same list chrome and filters as today once inside an author or **All**.

## Technical approach (when implementing)

Reuse the MTG collection screen machine rather than inventing a second navigation model:

1. **Screen state** on `app/(app)/index.tsx` — per catalog tab, something like `overview | bucket | all`, plus `activeBucketKey` (genre name or normalized author string). Reset when leaving the tab.
2. **Pure helpers** (unit-tested), e.g. `lib/catalogOverview.ts`:
   - Summarize genres from movies / authors from books.
   - Normalize author strings for grouping (trim; decide case-folding).
   - Count titles per bucket with multi-membership.
   - Filter summaries by overview search query.
3. **UI** — overview components parallel to `MtgCollectionOverview` (totals + tile grid + open-all). Keep `MovieResults` / `BookResults` for bucket and all screens.
4. **Data** — no schema change; use existing `movies.genres` and `books.authors`.
5. **Prefs** — keep layout/sort/availability on the drilled lists; overview itself does not need a new sort pref for v1 unless we later want “sort buckets by count.”

Out of scope for the first cut: year/decade overview tiles, format chips as primary buckets, cross-tab “recently added” hubs, changing TMDb/Open Library ingest.

## Implementation checklist (later)

- [ ] `catalogOverview` helpers + unit tests (genre/author summarize, multi-membership, Unknown, search filter)
- [ ] Movies tab: overview / genre / all screen state + header back
- [ ] Books tab: overview / author / all screen state + header back
- [ ] Overview UI (totals, tiles, All escape hatch)
- [ ] Wire search placeholders and filters so overview vs bucket vs all behave clearly
- [ ] Reset to overview when switching away from the tab
- [ ] README Planned entry stays until shipped, then move to Features

## Open when coding starts

- Overview search: filter tiles only, or also surface matching titles (MTG overview today searches sets; card hits are a separate path).
- Bucket tile order: alphabetical vs most titles first.
- Whether overview totals respect the lending **availability** filter or always show full-library counts.
- Author normalization edge cases (identical names with different punctuation; multi-author credit order).
- How dense the Unknown bucket is allowed to get before we nudge refresh-from-catalog on detail screens.
