# DraftForge V8.13 Validation Report

## Regression suite

The full retained DraftForge test suite passes after the V8.13 Row-by-Row Results conversion:

- 12/12 standard full-draft smoke tests complete with valid required rosters.
- 14/14 full 14-team mock drafts complete with valid required rosters.
- Live pick-by-pick flow and on-clock survival forecast pass.
- Bye-week mapping/exposure/recommendation adjustment pass.
- Legacy Yahoo Results OCR alignment test recognizes 12/12 sample rows.
- V8.9 board snapshot reconstruction test remains green.
- V8.10 dynamic-board test remains green.

## V8.13 Results parser

A dedicated Results-row parser test uses synthetic Tesseract-style word geometry modeled on Yahoo **Results → Round by Round**. It verifies:

- result rows are detected before player matching so names cannot drift onto neighboring picks;
- consecutive descending pick numbers can repair a dropped leading digit without changing player identity;
- newest-first Yahoo rows are reordered into chronological overall-pick order;
- player names resolve against the DraftForge player pool;
- the fantasy-team column can identify `Your Team` / user slot when visible;
- overlapping previously stored picks are treated as confirmation;
- only the new contiguous picks are proposed for application.

Result: **PASS**. The retained engine suite also passes 12/12 standard slots and 14/14 14-team slots.

## Editable Draft Tracker

V8.13 treats applied overall-pick rows as the canonical draft ledger. Manual correction rebuilds engine state sequentially from the corrected rows, which prevents a player from remaining simultaneously drafted and available and ensures all team rosters, user roster, bye load, and opponent-pressure calculations use the same corrected state.

## Safety behavior

Screenshot OCR never directly mutates the live draft. Detected rows are staged in the review panel first. Missing, unresolved, conflicting, or duplicate picks block Apply until corrected. This preserves DraftForge's no-guess draft-day rule.
