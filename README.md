# DraftForge V8.10 — Dynamic Board Reader

DraftForge V8.10 turns the Yahoo **Board** screenshot into the live-draft input. The intended draft-day workflow is one screenshot per round, taken when you are on the clock.

## What V8.10 does from one Yahoo Board screenshot

- Detects the 12 draft columns and snake-draft pick order.
- Detects the current `ON THE CLOCK` cell.
- Identifies the user's `You` column and can infer the draft slot.
- Reconstructs every completed pick visible on the board.
- Builds and updates all 12 fantasy-team rosters.
- Builds and updates your roster.
- Marks every recognized drafted player unavailable in DraftForge.
- Preserves prior-round draft memory in browser local storage.
- Reconciles each new board snapshot against the saved state instead of starting over.
- Refuses to guess when a completed pick is missing or conflicts with saved memory.
- Immediately recalculates Best Move Now using value, roster need, opponent roster pressure, turn survival, tier pressure, scoring settings, and 2026 bye-week fit.

## Draft-day workflow

1. Open Yahoo and DraftForge side by side.
2. Put DraftForge in **Live Draft** mode.
3. Start/reset the live draft before Round 1.
4. When Yahoo says you are on the clock, use `Win + Shift + S` and capture the full Yahoo Board view.
5. Switch to DraftForge and press `Ctrl + V`.
6. DraftForge reads the board, applies a clean snapshot automatically, and refreshes the recommendation.
7. Make the recommended/desired selection in Yahoo.
8. Repeat once on your next turn.

If OCR is uncertain, the review window stays open and DraftForge leaves the stored draft unchanged.

## GitHub Pages

The repository is static and GitHub Pages-ready. `index.html` is in the repository root.

Use:

- **Settings → Pages**
- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/(root)**

No server is required for Board Snapshot mode. Tesseract.js is loaded in the browser for OCR.

## Main files

- `index.html` — UI shell
- `styles.css` — application styling
- `app.js` — UI, persistence, screenshot workflow
- `engine.js` — DraftForge recommendation engine and bye-aware scoring
- `sync.js` — Yahoo OCR matching, board-grid parsing, reconciliation
- `data/players.js` / `data/players.json` — player pool
- `data/presets.js` / `data/presets.json` — league presets
- `tests/` — engine and screenshot regression tests

## Safety behavior

DraftForge does **not** fill a missing board cell by inventing a player. A snapshot is auto-applied only when the new selections form a continuous, conflict-free sequence from the last saved pick to the detected current pick.


## V8.10 dynamic Yahoo board detection

V8.10 no longer assumes a 12-team grid. The board reader tests plausible league sizes and chooses the geometry that reconstructs the strongest continuous pick sequence. On a fresh live draft, it can automatically update DraftForge from 12 teams to 14 teams and detect the user's Yahoo column. For best results, zoom Yahoo out until every team column is visible in the screenshot.
