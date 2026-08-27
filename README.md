# DraftForge V8.13 — Row-by-Row Results

DraftForge V8.13 changes the live-draft workflow to use Yahoo **Results → Round by Round** as the primary screenshot source. The Results page exposes explicit overall pick numbers and clean player rows, which is substantially easier to OCR reliably than the compressed Yahoo Board.

## Primary draft-day workflow

1. Set DraftForge to **Live Draft** and choose the correct league size / draft slot.
2. In Yahoo, open **Results → Round by Round**.
3. Every ~3–5 picks, or when you get within 3–5 picks of your turn, take a snip showing several recent results.
4. Paste the snip into DraftForge with **Ctrl+V**.
5. Review the detected rows. Low-confidence or unresolved rows are editable before anything is applied.
6. Click **Apply Reviewed Picks**.
7. DraftForge updates the Draft Tracker, all team rosters, available-player pool, bye-week exposure, opponent pressure, survival odds, and Best Move Now.

Overlapping previously synced picks are useful: DraftForge treats them as confirmation and adds only new picks.

### V8.13 row reader

V8.13 no longer asks one whole-screen OCR pass to pair pick numbers and players. It locates the Results header, detects the horizontal result-row bands, enlarges only the Results table, groups OCR words by row, and infers the consecutive descending pick sequence from multiple rows. If a pick number loses a leading digit (for example `12` reading as `2`), neighboring rows can repair the sequence. Player identity is still never guessed: ambiguous rows remain editable **FIX** rows. A capped second OCR pass is used only for unresolved new rows to keep the live workflow fast.

## Editable Draft Tracker

The tracker is the authoritative draft ledger. Every applied selection records:

- overall pick
- snake-draft team slot
- player
- position / NFL team

If OCR gets a player wrong, use **Draft Tracker → Add / correct a pick**. Correcting one pick reconstructs the full draft state from the ledger, so drafted/available players, your roster, every opponent roster, bye load, and recommendations all update together.

## Safety behavior

DraftForge does not guess through an unresolved gap. A screenshot is reviewed first and no state is changed until the new pick sequence is continuous. If one result is unclear, type the correct player into that row or use the tracker.

## Engine retained from V8.11

- Turn-aware TAKE NOW / LEAN TAKE / CAN WAIT logic
- Opponent roster pressure
- Player survival-to-next-turn forecasts
- Bye-week-aware roster scoring
- 12- and 14-team snake-draft support
- Local browser draft memory
- Mock draft mode
- Undo / roster safeguards

## GitHub Pages

Upload the contents of this folder to the root of the existing DraftForge repository and commit to `main`. GitHub Pages will redeploy the same URL. After deployment, use **Ctrl+Shift+R** once to replace the previous service-worker cache.
