# DraftForge V8.11 — Tile Vision Board Reader

DraftForge V8.11 keeps the one-screenshot-per-round live-draft workflow, but replaces the fragile fixed-row Yahoo OCR path with a tile-first vision pipeline.

## Why V8.11 exists

V8.10 could identify 12- vs 14-team boards, but it still assumed a fixed vertical board origin before OCR. Real Yahoo mocks move the board depending on browser size, zoom, ads, and league layout. That could cause entire sections of a round to be missed even when the screenshot was good.

V8.11 finds Yahoo's colored player tiles **before** OCR. The tile geometry becomes the source of truth for league size, rows, columns, snake-pick numbers, and the current clock cell.

## Live workflow

1. Open Yahoo's **Board** tab.
2. Zoom out until every team column is visible at once.
3. When you are on or near the clock, press `Win + Shift + S`.
4. Capture the full Yahoo draft view.
5. Switch to DraftForge Live Draft mode and press `Ctrl + V`.
6. DraftForge detects the player-tile grid, OCRs only the new drafted tiles, rebuilds the cumulative state, and refreshes the recommendation.

## V8.11 screenshot pipeline

- Detects the actual colored Yahoo player-tile rectangles from image pixels.
- Infers league size from the fullest visible draft row (works with 12- and 14-team layouts used in testing).
- Detects the purple **ON THE CLOCK** tile from its background color.
- Reconstructs snake-draft overall pick numbers from row/column location.
- Upscales each new player tile independently before OCR instead of reading one tiny full-board image.
- Uses the tile background to supply an additional position signal (QB/RB/WR/TE) to player matching.
- Automatically retries unresolved tiles at higher resolution with an alternate preprocessing pass.
- On later rounds, OCRs only picks that are new since the last saved snapshot. Previously confirmed picks stay in DraftForge memory and do not have to be re-read every round.
- Refuses to apply a snapshot if a required new pick remains unresolved or conflicts with saved memory.

## Draft state maintained from the screenshot

- Every team roster
- Your roster and draft slot
- Drafted / unavailable player pool
- Current overall pick
- Opponent positional needs before your next turn
- Tier and scarcity pressure
- Survival-to-next-turn estimates
- Bye-week exposure and bye-fit adjustments

## GitHub Pages

The app is static and can be deployed from the repository root with GitHub Pages. Browser OCR loads Tesseract.js from jsDelivr; no secret or server is needed for screenshot mode.

## Safety rule

DraftForge does not fill a missing required pick by inventing a player. If both OCR passes cannot resolve a new tile confidently, the stored draft remains unchanged.
