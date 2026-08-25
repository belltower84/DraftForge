# DraftForge V8.8 Draft Day Guide

## Before the room opens

- Open Yahoo and DraftForge side by side.
- Select **Live Draft**.
- Confirm league size, scoring, roster slots, and your draft slot.
- Do not press Reset Live Draft once the real draft has started unless you truly want to erase the current draft state.

## Screenshot workflow

1. In Yahoo choose **Results → Round by Round**.
2. Press `Win + Shift + S` and capture the results table.
3. Press `Ctrl+V` anywhere in DraftForge.
4. DraftForge opens Smart Screenshot Sync and begins reading the image automatically.
5. Verify **KNOWN** and **NEW** rows.
6. Press **Apply & Recommend**.
7. DraftForge stores the picks locally and refreshes Best Move Now.

### First screenshot
Include the whole draft so far. This establishes chronological pick memory.

### Later screenshots
They may overlap older picks. DraftForge uses the overlap to continue from its existing memory and ignores selections it already knows.

## Manual live workflow

- Opponent pick: click **Gone**.
- Your pick: make the selection in Yahoo, then click **Draft** in DraftForge.
- Mistake: click **Undo**.

## Safety rule

DraftForge never deliberately fills a missing selection by guessing. If a screenshot does not provide enough overlap/continuity, it stops and asks for a more complete Yahoo Results capture.


## Bye-week logic
DraftForge now uses the official 2026 NFL bye schedule. Treat the bye adjustment as a roster-construction tiebreaker, not a command to pass on an elite value. The engine intentionally weights bye conflicts lightly in the first three rounds and more heavily as the roster fills. Same-bye backup QBs and TEs are penalized more strongly because they cannot cover the starter during the bye.
