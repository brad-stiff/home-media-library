# Games catalog — work plan

Status: **planned** (no implementation yet). Decisions below are locked from product discussion; open items are called out at the end.

## Goal

Ship a **Games** library tab for household video games, with the same **overview → drill-in → all** pattern MTG (and the planned books/movies overviews) already use. Overview buckets are **platforms** (consoles / PC), shown as tiles with a platform mark and a title count — not a flat dump of every game.

**Board games** stay out of this phase. They remain a later phase, kept separate from video games (no mixed shelf).

## Why platform buckets

A household game shelf is usually “what’s on the Switch?” or “what’s on the PS5?”, the same way MTG browsing starts from sets. Genre and year are weaker primary units here (thin buckets, weaker mental model). Year can still be a **sort** on title lists later, like movies and books.

## Product decisions (locked)

| Topic | Decision |
| --- | --- |
| Scope for this phase | **Video games only** |
| Board games | **Deferred** — separate from video games when they arrive; not mixed into the video catalog |
| Dock | One **Games** tab (already reserved in prefs; not in `SHIPPED_DOCK_TYPES` yet) |
| Tab mode | Prefer a **Video / Board** segmented control on the Games tab (same idea as MTG Collection / Decks). This phase ships **Video** only; Board stays hidden or disabled until that phase |
| Overview primary bucket | **Platform** (Switch, PlayStation, Xbox, PC, etc.) |
| Overview tile | Platform **symbol/mark** + platform **name** + **game count** (parallel to MTG set icon + name + owned count; no completion ring unless we later track a platform “checklist”) |
| Pattern | **overview** → platform list → **All games** escape hatch, with header back to overview |
| Missing platform | Titles with no platform → a single **Unknown** bucket |
| Multi-platform ownership | Open when coding starts (see below) — default lean: one row can list more than one platform and appear in each matching tile |
| Lending / checkout | Follow movies/books only if physical ownership is modeled; open item |
| Catalog ingest | Open when coding starts (manual entry first vs IGDB / other API) |

## Proposed UX

### Games tab shell

1. Opening **Games** lands on the **Video** mode overview (not the full title grid).
2. A **Video | Board** control matches MTG’s Collection | Decks segment. Board is out of scope for this phase: either omit the control until Board exists, or show Board disabled / “Coming later.” Prefer **omitting** until Board ships so the tab does not advertise an empty mode.
3. Leaving the tab resets to overview (same habit as MTG collection).

### Video overview

1. Header shows light totals (e.g. game count · platform count).
2. Overview is a scrollable grid of **platform tiles**: mark + label + count.
3. Tap a tile → that platform’s titles (grid/list chrome parallel to movies/books).
4. **All games** opens the ungrouped video library.
5. Search on overview filters **platform names** (and optionally jumps into titles — same open question as books/movies overview). Search on a platform or **All** searches titles.

### Board (later phase — not this plan’s build)

- Separate mode under the same Games tab, **not** a second dock tab (unless we revisit).
- Its own overview buckets (likely something other than console platform — e.g. genre or player count). Decide in that phase.
- No shared title list with video games.

## Platform tiles (what “by platform” means)

Yes: **tiles**, not chips or a plain filter list.

Each tile is roughly:

- **Mark** — a simple console / platform symbol (SVG or monochrome asset), analogous to an MTG set icon inside the set tile.
- **Label** — e.g. Nintendo Switch, PlayStation 5, Xbox Series X|S, PC, Other.
- **Count** — number of video game titles on that platform in the household library.

No completion percentage ring in v1 (unlike MTG sets). A platform is not a fixed checklist the way a printed set is.

Exact platform enum and artwork are open when coding starts; the overview should only show platforms that have at least one title (plus Unknown when needed).

## Technical approach (when implementing)

1. **Schema** — new household table(s) for video games (title, platform(s), optional cover, year, notes, ownership facts). Prefer a controlled platform enum rather than free text alone, with room for “Other” / Unknown.
2. **Ship the dock** — add `games` to `SHIPPED_DOCK_TYPES` once screens exist; prefs already reserve the id and label.
3. **Screen state** on `app/(app)/index.tsx` — Games mode `video` (and later `board`); video screen `overview | platform | all`, plus `activePlatformKey`. Reset when leaving the tab.
4. **Pure helpers** (unit-tested), e.g. `lib/gamesOverview.ts` — summarize platforms, counts, Unknown, overview search filter.
5. **UI** — overview component parallel to `MtgCollectionOverview` (totals + tile grid + open-all), lighter tiles (mark + name + count, no ring).
6. **Backup** — extend `buildLibraryBackup` when the table exists (comment already notes games arrive later).
7. **README** — move this entry from Planned to Features when shipped.

Out of scope for the first cut: board games UI, Pokémon, cross-tab hubs, treating movie digital “platform” (Vudu, etc.) as game consoles — that field stays movies-only.

## Implementation checklist (later)

- [ ] Schema + RLS for video games; migration documented for existing projects
- [ ] Platform enum + mark assets (or text-only fallback until assets land)
- [ ] `gamesOverview` helpers + unit tests
- [ ] Games tab: overview / platform / all screen state + header back
- [ ] Add / edit / detail flows for video games (ingest TBD)
- [ ] Wire search placeholders for overview vs platform vs all
- [ ] Ship `games` in `SHIPPED_DOCK_TYPES` and household/personal visibility
- [ ] Backup export includes games
- [ ] README Planned → Features when shipped

## Open when coding starts

- **Board control**: omit until Board phase vs show disabled — plan leans **omit**.
- **Multi-platform titles**: one library row with multiple platforms (multi-membership on overview) vs one row per platform copy owned.
- **Physical vs digital**: disc/cartridge flags, digital storefronts, and whether checkout applies.
- **Ingest source**: manual-only v1 vs IGDB (or similar) search/cover art; barcode later if useful.
- **Platform list**: which consoles ship in the first enum (legacy generations? handhelds?).
- **Overview search**: filter tiles only, or also surface matching titles (same open item as books/movies overview).
- **Tile order**: alphabetical vs most titles first.
- **Cover art** on drilled lists: required for grid parity with movies, or title-first list until an API exists.
