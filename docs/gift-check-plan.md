# Gift check (shareable ownership lookup) — work plan

Status: **planned** (no implementation yet). Decisions below are locked from product discussion; open items are called out at the end.

## Goal

Let someone buying a gift for a household member answer **“do they already have this?”** without seeing the full private library.

Ship two pieces together:

1. **Shareable check-before-you-buy link** — a time-bounded, revocable link that only supports lookup, never browse.
2. **Format- and copy-aware answers** — when a match exists, say *how* it is owned (movie formats, MTG qty/foil), not only yes/no.

Wishlist / public catalog / gifter household roles are **out of scope** for this plan.

## Why this shape

Alcove’s library is household-private (RLS). Opening the shelf to outsiders fights that model. A gift buyer usually has a candidate title already — they need a **point query**, not discovery.

Ownership in Alcove is already richer than presence:

- **Movies** — `has_bluray` / `has_4k` / `has_digital` (and optional digital `platform`)
- **Books** — presence of a row (ISBN / title)
- **MTG** — `qty` plus separate foil vs non-foil rows

A blunt “owned” flag would hide useful gift guidance (e.g. Blu-ray owned, 4K missing; two non-foil, zero foil).

## Product decisions (locked)

| Topic | Decision |
| --- | --- |
| Scope | **Lookup link + format/copy-aware status** only |
| Privacy | Gifter **never** browses or lists the household library |
| Answer shape | Status for the candidate only: not owned / owned / owned in other formats or copies |
| Media in v1 | **Movies, books, and MTG cards** (same catalogs the app already ships) |
| Movie answer | Report each owned format flag; digital may include `platform` when set |
| Book answer | Owned or not (row presence); edition nuance stays open |
| MTG answer | Report qty for non-foil and foil separately when either exists |
| Soft / “close enough” matches | **Deferred** — v1 is exact catalog-id (or barcode/ISBN) match only |
| Wishlist | **Out of scope** |
| Gifter account / household role | **Out of scope** — no login required for the gifter |
| Library browse for outsiders | **Never** |
| Owner control | Household **admin** (at least) can create, revoke, and see active links |

## Proposed UX

### Owner (inside Alcove)

1. Settings or Household offers **Gift check**.
2. Admin creates a link: optional label (e.g. “Mom’s birthday”), optional expiry, optional passphrase.
3. App shows a shareable URL (and optionally a QR). OS share sheet is enough for v1.
4. Admin can **revoke** any active link; revoked/expired links refuse all lookups.
5. Creating a link does **not** change RLS or expose export/backup.

### Gifter (opens the link)

1. Minimal page: household display name (or a label the owner chose) + search / scan affordances.
2. Gifter picks a **candidate** the same way Alcove already resolves catalog items where practical:
   - Movies: title search (TMDb) and/or barcode
   - Books: title/ISBN search and/or barcode
   - MTG: name/printing search (Scryfall)
3. Submit → one status card for that candidate. No “similar titles in your library,” no related shelf, no counts of total titles.
4. Passphrase (if set) is required before any lookup.

### Status card (format-aware)

Examples of what the card should communicate:

| Catalog | Example result |
| --- | --- |
| Movie not in library | **Not owned** |
| Movie partial | **Owned:** Blu-ray · **Missing:** 4K, digital |
| Movie complete for flags they use | **Owned:** Blu-ray, 4K, digital (Vudu) |
| Book | **Owned** or **Not owned** |
| MTG not owned | **Not owned** |
| MTG partial | **Owned:** 2 non-foil · **Missing:** foil |
| MTG both finishes | **Owned:** 1 non-foil, 1 foil |

Do not invent formats the household does not track. Movies stay on the three ownership flags; books stay presence; MTG stays qty × foil.

## Privacy rules (non-negotiable)

- No endpoint may return “all movies,” “all books,” or “all cards.”
- Lookup requires a concrete candidate id (TMDb id, ISBN / book key, Scryfall id) or a barcode/ISBN that resolves to one — not free-text scan of the private shelf.
- Responses must not include lending/checkout state, who added the item, notes, deck lists, or backup data.
- Link tokens are unguessable secrets; treat like invite codes, with revoke + expiry.
- Rate-limit lookups per link (exact limits open when coding).

## Technical approach (when implementing)

Sketch only — confirm against Expo SDK 57 docs and current Supabase patterns before coding.

1. **Schema** — e.g. `gift_check_links` keyed by household: opaque token hash, label, optional passphrase hash, `expires_at`, `revoked_at`, `created_by`, timestamps. Store **hashes**, not raw tokens/passphrases.
2. **Lookup API** — server-side path (Edge Function or equivalent) that:
   - Validates token (+ passphrase, expiry, revoke)
   - Accepts catalog type + candidate id (or barcode/ISBN to resolve)
   - Reads household ownership with a privileged client **only for that candidate**
   - Returns the status DTO above
3. **Gifter surface** — lightweight web page reachable from the shared URL (Expo web route or small hosted page). Owners keep managing links in the native app.
4. **Owner UI** — create / list / copy / revoke under Settings or Household; share via existing `Share` patterns.
5. **Pure helpers** (unit-tested) — map movie/book/MTG rows → status DTO; never leak extra fields.
6. **RLS** — ordinary members still cannot read other households; the lookup path must not weaken table policies for anonymous clients. Prefer token-gated server function over opening select policies.
7. **README** — move this entry from Planned to Features when shipped.

Out of scope for the first cut: wishlist, soft matches, gifter accounts, QR-only offline mode beyond linking to the same URL, games/Pokémon, advertising total collection size, “notify owner that someone checked X.”

## Implementation checklist (later)

- [ ] Schema + migration for gift-check links (token/passphrase hashes, expiry, revoke)
- [ ] Token-gated lookup API returning format/copy-aware status only
- [ ] Status DTO helpers + unit tests (movie formats, book presence, MTG qty/foil)
- [ ] Owner UI: create, share, list, revoke
- [ ] Gifter web UI: unlock (if passphrase), search/resolve candidate, show status card
- [ ] Rate limiting / abuse basics
- [ ] README Planned → Features when shipped

## Open when coding starts

- **Surface hosting**: Expo web route on the same project vs separate minimal page; exact public URL shape.
- **Who can create links**: admins only vs admins + members.
- **Default expiry**: e.g. 30 days vs no expiry until revoke; whether passphrase is optional or encouraged.
- **Barcode on gifter web**: camera scan on mobile browsers vs paste barcode/ISBN only in v1.
- **Book editions**: treat any ISBN/title row as owned, or try to distinguish hardcover/paperback when metadata allows (lean: presence-only in v1).
- **MTG printing vs oracle**: match exact `scryfall_id` only, or also report “owned under another printing of the same oracle” (lean: exact printing in v1; oracle rollup is a soft-match follow-on).
- **Digital platform text**: always show movie `platform` when `has_digital`, or only when non-null.
- **Household label on the gifter page**: household name vs owner-chosen link label only (privacy vs clarity).
- **Rate limits and lockout** after failed passphrase attempts.
- **Audit log**: whether the owner sees “N checks” without seeing which titles (lean: count-only or none in v1).
