# MTG card scanner — work plan

Status: **planned** (no implementation yet). Decisions below are locked from product discussion; open items are called out at the end.

## Goal

From the **MTG add** flow only, let someone choose **Scan** or **manual entry**. Scanning uses the phone camera continuously, identifies cards **on device** (no cloud vision API), and queues results. Uncertain cards never block the live scan; the user resolves them before leaving the session. Foil is chosen at confirm.

## Why a development build (not Expo Go)

On-device OCR means Apple Vision (iOS) or Google ML Kit (Android). Those ship as **native modules**. Expo Go only includes a fixed set of native modules; OCR is not among them.

- **Expo Go today:** camera preview and barcode scan already work; card **text** recognition does not.
- **Development / EAS build:** we add an OCR native module, rebuild the app binary once, then Scan can read card text without uploading photos.
- **Tesseract.js** is not a workaround: its WASM build does not run under Hermes in React Native.
- **Cloud vision APIs** would avoid a custom binary but were rejected (privacy / on-device only).

So “need a build” means “need an app binary that includes OCR,” not “need a cloud vision service.” Scryfall remains a normal catalog HTTP lookup after text is read locally (same as today’s search).

Manual Scryfall search should keep working in Expo Go. Scan can show a short “needs a native Alcove build” message until that binary exists.

## How commercial TCG scanners differ

ManaBox / TCGplayer-style tools mostly **match artwork** (computer vision fingerprints) against a huge printing index. This plan uses **OCR of printed text** instead: name plus the modern collector line (set code + collector number), then Scryfall. That is enough for a household library and fits Expo + existing Scryfall usage. Exact art-matching can stay a later upgrade if continuous speed or borderless cards become painful.

## Product decisions (locked)

| Topic | Decision |
| --- | --- |
| Entry point | MTG **add** only: **Scan** or **manual entry** (not the movie/book Scan tab) |
| Recognition | On-device OCR only — no cloud vision API |
| Catalog | Scryfall after OCR (set+collector when possible, else name search) |
| Certain match | Auto-queue during the session; do **not** stop the live camera |
| Uncertain / ambiguous | Queue for review; user picks the printing **before** cards are written to the library |
| Session end | Review remaining uncertainties, then commit queued adds |
| Foil | Toggle at **confirm** (default nonfoil) |
| Expo Go | Manual search OK; Scan requires a development build with OCR |

“Certain” vs “uncertain” here is about **which printing** (and whether OCR was confident), not about foil. Foil is always a confirm-time toggle, even for certain matches.

## Proposed UX

1. **Add MTG card** opens a chooser: **Scan** | **Search** (current Scryfall search stays as Search).
2. **Scan** (native build): full-screen camera, continuous capture (throttled stills or frames → OCR).
3. Overlay / tray shows recently queued cards (name, set, collector #). Certain hits accumulate without a modal.
4. Uncertain hits append to a **Needs review** list; scanning continues.
5. **Done / Exit** opens review:
   - Certain queue: foil toggle + confirm add (or bulk confirm with per-row foil).
   - Needs review: pick printing (and foil), or skip/discard.
6. Only after confirm do rows hit `addMtgCardFromScryfall` / collection.

## Technical approach (when implementing)

1. **OCR module** — e.g. `expo-text-extractor` or equivalent Vision/ML Kit Expo module; config plugin + camera permission copy updated for cards.
2. **Capture loop** — `expo-camera` `CameraView` + periodic `takePictureAsync` (quality/size tuned for OCR); ignore frames while a recognition is in flight; debounce “same card still in frame.”
3. **Parse OCR lines** (pure TS, unit-tested):
   - Prefer collector corner: set code + collector number → `GET /cards/{set}/{collector_number}`.
   - Else card name → Scryfall search; if multiple printings, mark **uncertain**.
   - Pre-modern cards without a collector line → name path + uncertain unless a single printing is obvious.
4. **Confidence rules** — exact set+cn hit with one Scryfall card → certain; multiple candidates, weak OCR, or name-only with several printings → uncertain.
5. **Session state** — in-memory queues for certain vs needs-review; foil defaults false until confirm.
6. **Expo Go** — feature-detect missing native OCR; keep Search; Scan shows the build requirement.
7. **Docs / README** — document that card scan needs a development build; Expo Go remains fine for the rest of Alcove.

Out of scope for the first cut: artwork fingerprinting, foil detection from the photo, non-English OCR tuning, bulk ADF/feeder hardware, wiring into deck-add or the global barcode Scan tab.

## Implementation checklist (later)

- [ ] Add OCR dependency + app config / permissions for a development build
- [ ] MTG add chooser: Scan vs Search
- [ ] Continuous scan screen + capture/OCR loop + same-card debounce
- [ ] OCR → set/cn / name parsers + Scryfall resolve helpers + unit tests
- [ ] Session queues (certain / needs review); non-blocking uncertain path
- [ ] Exit/confirm UI: printing picker, foil toggle, then library writes
- [ ] Expo Go graceful message when OCR native module is absent
- [ ] README: how to run a native build for card scan

## Open when coding starts

- Which OCR package to pin for Expo SDK 57 (Vision/ML Kit wrapper maturity).
- Exact confirm UI: one-by-one vs list with per-row foil.
- Whether “certain” auto-queued cards still show a lightweight tray confirm (foil only) or only appear in the exit summary.
