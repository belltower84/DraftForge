# DraftForge V8.5 — Turn-Aware

GitHub-ready modular build of the latest DraftForge draft engine.

## What is in this build

- **V8.5 Turn-Aware recommendation engine**
  - market rank/value
  - roster need
  - scoring-format adjustments
  - tier scarcity as a tiebreaker
  - opponent roster demand between your turns
  - projected next-pick survival
  - `TAKE NOW`, `LEAN TAKE`, `VALUE CALL`, and `CAN WAIT` decisions
- **Stress-tested roster safeguards**
  - reserves enough remaining picks to finish required positions
  - permanent TE cap in normal one-TE leagues
  - late-only optional QB3 logic
  - K/DST endgame protection
- **292-player Aug. 24 board package** with injury/market flags
- Yahoo 12-team Superflex/PPR user-league preset plus Yahoo, ESPN, Sleeper, NFL Fantasy, and DraftForge presets
- Mock-draft opponent simulation
- Opponent Intelligence panel
- Screenshot/manual draft-board review flow
- Copy Draft State fallback
- Yahoo server-sync hooks
- My Team, weekly lineup demo model, and draft analytics
- PWA manifest + service worker for installable/static hosting

## GitHub Pages

The root of this repository is a static site. Enable GitHub Pages from the repository root (`main` / root) and `index.html` will be the entry point.

No build step is required.

## Local use

You can open `index.html` directly for most features. For service-worker/PWA behavior, serve the folder over HTTP, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Yahoo Live Sync and Screenshot AI

The static GitHub Pages build deliberately contains **no passwords, OAuth client secrets, API keys, tokens, or cookies**.

The UI includes server hooks for:

- `GET /api/yahoo/picks?leagueId=...`
- `POST /api/screenshot/analyze`

The included optional `server/` folder is a safe starter server and returns `501 Not Configured` for those integrations until you wire in server-side providers and environment variables. The core draft engine, mock drafts, manual Screenshot Sync, and Copy Draft State all work without those integrations.

## Files

- `index.html` — application shell
- `styles.css` — Forge UI
- `app.js` — browser UI/state layer
- `engine.js` — V8.5 Turn-Aware engine
- `data/players.js` / `data/players.json` — 292-player board
- `data/presets.js` / `data/presets.json` — league presets
- `tests/smoke.cjs` — 12-slot full-draft validation
- `STRESS_TEST_REPORT.md` — prior stress results + GitHub-port validation
- `manifest.webmanifest`, `sw.js` — static/PWA support
- `server/` — optional secret-backed integration starter

## Run validation

With Node installed:

```bash
node tests/smoke.cjs
```

Expected result:

```text
PASS: 12/12 full-draft smoke tests completed with valid required rosters.
```

## Version

**DraftForge V8.5 Turn-Aware — Aug. 24, 2026 board**
