# DraftForge V8.10 Validation Report

## Engine regression
- 12/12 draft slots completed full simulated drafts.
- Required roster construction remained valid across all 12 slots.
- V8.6 live pick-by-pick flow still passes.
- On-clock next-turn survival calculation remains active.

## Screenshot-memory regression
The supplied Yahoo **Results → Round by Round** screenshot was used to tune the V8.7 OCR pipeline.

Browser-equivalent preprocessing plus OCR resolved all 12 visible Round 1 selections:
1. Jahmyr Gibbs
2. Bijan Robinson
3. Ja'Marr Chase
4. Puka Nacua
5. Christian McCaffrey
6. Jonathan Taylor
7. Amon-Ra St. Brown
8. James Cook III
9. Jaxon Smith-Njigba
10. Chase Brown
11. CeeDee Lamb
12. Saquon Barkley

The raw OCR contained several distortions (for example Barkley, McCaffrey, Nacua, Chase and Robinson were not perfectly transcribed). V8.7 resolves those rows using Yahoo's abbreviated-name pattern plus position/team metadata rather than exact-name OCR alone.

## Cumulative memory test
- Existing picks are persisted in localStorage.
- An overlapping later screenshot correctly marks prior selections as KNOWN.
- Only new selections are queued for application.
- Pick alignment continues from the latest remembered overlapping player.
- Missing sequential picks stop the sync instead of being guessed.

## Commands
```bash
node tests/smoke.cjs
node tests/live-engine.cjs
node tests/screenshot-sync.cjs
node tests/bye-aware.cjs
node tests/board-snapshot.cjs
```

All tests passed on the packaged build.

## V8.8 bye-aware regression
- Official 2026 team bye mapping loaded for all 32 NFL teams.
- Bye exposure updates from the user's roster state.
- Same-bye candidates receive a dynamic score adjustment; clean alternatives can receive a small diversity bump when the roster is already concentrated.
- Same-bye backup QB/TE decisions receive stronger penalties.
- Early-round stage scaling protects elite value from excessive bye-week weighting.
- Lineup Optimizer returns zero projection with BYE status on the mapped bye week.
- `tests/bye-aware.cjs`: PASS.
- Existing full-draft, live-mode, and screenshot-memory tests: PASS.

## V8.10 board-snapshot regression

V8.10 adds a board-grid parser and full-state reconciliation layer. Regression coverage verifies that a single Yahoo-style board snapshot can reconstruct 42 completed selections through overall pick 42, identify the user's slot, detect overall pick 43 as the current clock, preserve snake-draft team assignment, and produce a conflict-free cumulative state.

The parser also preserves the V8.8 rule that missing selections are never invented to close a continuity gap.

### Actual Yahoo Board screenshot validation

The V8.10 parser was also run against OCR generated from the Yahoo Board screenshot used during development. It recognized **42/42 completed selections**, detected **overall pick 43** as the current clock, inferred **draft slot 5** from the Yahoo `You` column, found no continuity gaps, and rebuilt the slot-5 roster as **Puka Nacua, Drake London, and Chris Olave**.
