# DraftForge — Stress Test & GitHub Port Validation

**Board refresh:** 2026-08-24  
**Player pool:** 292  
**Primary league focus:** Yahoo 12-team, full PPR, 4-point passing TD, 1 QB + 1 Superflex, 2 RB, 3 WR, 1 TE, FLEX, DST, 7 bench

## Original draft-day stress campaign

The pre-V8.5 draft engine was stress-tested before the turn-aware opponent-pressure layer was added:

- **Phase A:** 120 complete user-league drafts — 10 simulations from every draft slot.
- **Phase B:** 24 additional complete all-slot regression drafts after reducing an over-aggressive tier-cliff bonus.
- **Platform regression:** 25 additional complete drafts across Yahoo, ESPN, Sleeper, NFL Fantasy and DraftForge presets.
- **Total:** 169 complete automated drafts.

### Fixes produced by testing

1. Tier scarcity was reduced to a tiebreaker rather than a top-of-board override.
2. Normal one-TE leagues received a permanent TE cap.
3. Remaining picks are reserved so required roster positions cannot be stranded at the end.
4. K/DST are protected until the end unless remaining-pick math requires them.
5. QB3 is optional, late-only, and must have legitimate starter value.

### User-league Phase A results

- Required-position / roster-validity failures: **0**
- QB: average **2.00**, range 2–2
- RB: average **5.18**, range 4–7
- WR: average **6.88**, range 5–8
- TE: average **1.93**, range 1–2
- DST: average **1.00**, range 1–1

Starter timing:

- QB2: average **Round 3.19**, range 2–6
- RB2: average **Round 5.66**, range 2–7
- WR3: average **Round 6.89**, range 3–9
- TE1: average **Round 7.88**, range 4–10

After the tier-cliff adjustment, the 24 all-slot regression drafts again produced **zero roster-validity failures**. The corrected 1.01 sanity check put Josh Allen at the top of the raw engine recommendation order.

### Platform regression

- Yahoo: 5/5 valid
- ESPN: 5/5 valid
- Sleeper Superflex: 5/5 valid
- NFL Fantasy: 5/5 valid
- DraftForge Demo Superflex: 5/5 valid

## V8.5 Turn-Aware GitHub port validation

The modular GitHub build was re-tested after separating the engine, player data, presets and UI.

Command:

```bash
node tests/smoke.cjs
```

Result:

- **12/12** draft slots completed a full draft.
- **12/12** finished with valid required rosters.
- Opening recommendation sanity check:
  - Josh Allen — **122.9**
  - Drake Maye — **122.5**
  - Lamar Jackson — **122.1**
  - Jahmyr Gibbs — **121.0**
  - Ja'Marr Chase — **120.9**

## V8.5 addition: turn-aware opponent pressure

V8.5 adds a second layer to the old market-only survival estimate. Before recommending that you wait, the engine now checks:

- every intervening snake-draft pick before your next turn,
- each opponent roster's positional needs,
- market proximity for the player at each intervening pick,
- how many players remain in the same position/tier,
- and whether the position is actually important to your own roster build.

That pressure changes both the displayed survival percentage and the recommendation score.
