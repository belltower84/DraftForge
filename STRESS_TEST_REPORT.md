# DraftForge V8.11 Validation Report

## Engine regression

The existing DraftForge regression suite remains green after the V8.11 screenshot-reader replacement:

- 12/12 complete 12-team mock drafts produced valid required rosters.
- 14/14 complete 14-team mock drafts produced valid required rosters.
- Live pick-by-pick state and Undo regression passed.
- Bye-week mapping / bye-fit recommendation regression passed.
- Existing screenshot name-matching regression passed.
- Existing board-snapshot and dynamic-board parser regressions passed.

## Real Yahoo geometry validation

The V8.11 tile detector was mirrored against two real Yahoo Board screenshots used during development:

- Full 14-team Yahoo board: detected **14 columns**, row occupancy **14 / 14 / 8**, and **36 colored tiles** including the current clock tile.
- 12-team Yahoo board: detected **12 columns**, row occupancy **12 / 12 / 12 / 7**, and **43 colored tiles** including the current clock tile.

This specifically validates the failure mode that V8.10 did not handle: the vertical board position changed substantially between Yahoo layouts even though both screenshots were valid.

## V8.11 safety behavior

The tile geometry determines which new overall picks are required. Each new tile is OCRed independently, with a second higher-resolution alternate pass for unresolved cells. A snapshot is applied only when the required new-pick sequence is continuous and conflict-free. DraftForge does not guess an unresolved player to close a gap.
