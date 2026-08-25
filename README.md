# DraftForge V8.6 — Live Draft Mode

GitHub Pages-ready fantasy football draft command center built on the V8.5 Turn-Aware engine.

## Draft-day workflow

1. Open Yahoo and DraftForge side-by-side.
2. Set **Mode = Live Draft** and choose your Yahoo draft slot.
3. Click **Reset Live Draft** immediately before the real draft starts.
4. For every opponent selection, click **Gone** beside the player Yahoo drafted.
5. When DraftForge shows **YOU'RE ON THE CLOCK**, make your selection in Yahoo first, then click **Draft** beside that player in DraftForge.
6. DraftForge never simulates opponent picks in Live mode. It waits for Yahoo.
7. If you fall behind, use **Screenshot Catch-Up**. On Windows: `Win + Shift + S`, crop the Yahoo recent-results panel, switch to DraftForge, press `Ctrl + V`, then **Analyze Screenshot Locally**. Review the detected names before applying them.
8. **Undo** reverses the most recent applied pick.

## Screenshot safety

Screenshot OCR runs in the browser using Tesseract.js loaded from jsDelivr. It is a catch-up tool, not the primary pick-entry method. DraftForge will **not invent missing picks**. If reviewed screenshot picks contain a gap, application stops at the missing pick.

For best OCR results, capture only Yahoo's recent draft-results list with player names visible. The first OCR run may need to load the OCR library, so open Screenshot Catch-Up once before the draft if you plan to use it.

## Engine preserved

- V8.5 Turn-Aware recommendation logic
- opponent positional-demand pressure
- next-turn player survival forecasts
- TAKE NOW / LEAN TAKE / VALUE CALL / CAN WAIT
- roster-construction safeguards
- 292-player Aug. 24, 2026 board
- mock opponent simulation (Mock mode only)

## GitHub Pages

This is a static site. Publish from `main` / repository root. No build step is required.

## Validation

Run:

```bash
node tests/smoke.cjs
node tests/live-engine.cjs
```

The engine smoke test should complete all 12 draft slots with valid required rosters.

## Version

**DraftForge V8.6 Live Draft Mode — Aug. 24, 2026 board**
