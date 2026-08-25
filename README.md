# DraftForge V8.8 — Bye-Aware Live Draft

DraftForge V8.8 keeps the V8.7 screenshot-memory workflow and adds 2026 bye-aware roster construction directly to the recommendation engine.

- Official 2026 NFL team bye-week map built into the static app.
- Recommendation scores now account for your current roster's same-week bye exposure.
- Early-round elite talent is only lightly affected; bye weeks become more important as close calls and bench/depth decisions develop.
- Same-bye backup QB/TE combinations receive stronger penalties because they fail to cover the starter's bye.
- Draft Board and Best Move Now show each player's bye and the bye-fit score adjustment.
- My Roster displays a live Bye Load summary.
- Lineup Optimizer now treats a player's real bye week as a zero-projection BYE.

## What changed in V8.8

- Paste a Yahoo **Results → Round by Round** screenshot anywhere in DraftForge with `Ctrl+V`.
- The screenshot modal opens and OCR starts automatically.
- Yahoo abbreviated names such as `S.BARKLEY`, `A.ST. BROWN`, `P.NACUA`, etc. are matched back to the DraftForge player pool.
- The app stores confirmed picks in browser `localStorage` and keeps them after refreshes.
- Later screenshots can overlap picks already remembered; DraftForge labels those **KNOWN** and only queues **NEW** selections.
- After **Apply & Recommend**, the board is updated and the turn-aware recommendation engine refreshes immediately.
- DraftForge will still stop instead of inventing a missing pick.

## Draft-day workflow

1. Open Yahoo and DraftForge side by side.
2. In DraftForge choose **Live Draft**, set the correct draft slot, and make sure League Setup matches the Yahoo room.
3. In Yahoo open **Results → Round by Round**.
4. First sync: screenshot the whole draft so far (`Win + Shift + S`).
5. Return to DraftForge and press `Ctrl+V` anywhere on the page.
6. DraftForge automatically analyzes the screenshot.
7. Review the detected rows. Existing selections show **KNOWN**; newly detected selections show **NEW**.
8. Click **Apply & Recommend**.
9. Repeat later. Once DraftForge has memory, a later screenshot only needs to overlap at least one already-known selection.

For the fastest possible workflow, individual picks can still be marked with **Gone** / **Draft**. Screenshots are the catch-up and primary bulk-sync option.

## GitHub Pages

Place the project files at the repository root and deploy `main` / `(root)` through GitHub Pages. No build system is required.

The first screenshot analysis loads Tesseract.js from a CDN. Yahoo OAuth is intentionally not embedded into this public static site because client-side credentials would expose secrets.

## Tests

```bash
node tests/smoke.cjs
node tests/live-engine.cjs
node tests/screenshot-sync.cjs
```

The screenshot-sync regression uses OCR text captured from the supplied Yahoo Round-by-Round example and verifies all 12 first-round players plus cumulative overlap alignment.
