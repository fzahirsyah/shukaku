# Phase 1 — Core play

Implementation date: 2026-10-24.

## Delivered

- Pure JavaScript validator: integer dimensions, bounds, exactly one clue, area, overlap, typed failures and locked-session protection.
- Full-coverage completion checks validate each region, clue ownership and exact total area; completed sessions reject additional moves and report completion once.
- Reversible PLACE, REPLACE, REMOVE, RESTART, UNDO and REDO commands, immutable board snapshots, 100-command history bound and move-token deduplication. Invalid replacements preserve the old board and history.
- Generalized board dimensions, Pointer Events with capture/cancellation, drag threshold, two-tap corner selection, explicit region selection and Change/Remove controls.
- Roving keyboard focus with arrow navigation, Enter/Space corners, Escape cancellation and Delete removal; zoomed cells scroll into view.
- Fit/zoom, explicit Draw/Pan, selection continuity across pan, reset view, safe gesture cancellation on resize.
- Interactive canonical 4×4 tutorial. Lessons require the first rectangle and full completion at the relevant steps; players can skip or restart.
- Three authored 5×5 starter levels with independent uniqueness checks. Classic completion unlocks the next starter level in memory. Other tiers state honestly that content is unavailable.
- Actual completion/replay/next-level sheets, input pause/resume and automatic Classic pause on backgrounding.
- Zen ready-made puzzle flow reuses the same board and engine, has no timer/score and starts a clean new attempt when requested.
- Removed P0 simulated board-state controls and fake result routes/times.

## Acceptance checks

The browser-runnable harness is `tests/index.html`. It uses native modules and browser APIs, with no test-toolchain install. `tests/content-verifier.js` is an independent, test-only exact-cover enumerator; it is not loaded by the game. Production solver/worker/hints remain P3.

**23 checks passed** in both Node and headless Chromium, covering VAL-01–07, WIN-01–02, UNDO-01–02, invalid puzzle structure, paused-state rejection, duplicate move tokens, replacement/remove/restart reversibility, 100-command history, local validity independent of the hidden answer and independent unique-solution verification of all four shipped puzzles.

An isolated headless Chrome instance (existing executable and existing runtime) additionally verified:

- Real emulated touch drag, two-tap placement and touch cancellation at 320 px.
- Invalid replacement leaves the previous region intact; undo and redo restore the board.
- Tutorial and all three starter levels can be completed using touch only.
- Next-level progression, completed replay, pause/resume and keyboard placement/removal.
- Generalized 12×12 zoomed-board keyboard targeting using an isolated QA fixture.
- Zen ready-made completion without timing and fresh next-puzzle session.
- 20 layout captures: Home, levels, game, Zen and dark Settings at 320×568, 360×800, 390×844 and 430×932, without horizontal overflow.
- No browser JavaScript errors.

Evidence: [machine-readable results](qa/phase-1/results.json), [phone board](qa/phase-1/board-390.png), [invalid replacement](qa/phase-1/M12-invalid-replacement-320.png), [real completion](qa/phase-1/M21-complete-level-1-320.png).

No user screen, visible browser window or existing tabs were used. No tools were installed. The temporary local QA server and headless browser were shut down.

## Content verification

The starter puzzles were authored as complete rectangle partitions; clue positions were selected and then checked by an independent enumerator. Each has exactly one solution, and the published canonical partition passes the same gameplay validator. Difficulty is provisional Beginner, pending human playtesting; grid size alone is not a difficulty certificate. This starter pack is not the final 30-level release collection.

## Boundaries and remaining review

Physical-phone touch, Safari, assistive-technology review and visual approval remain manual acceptance work. Headless touch emulation is useful evidence but does not replace those checks.

Session memory is temporary and resets on reload. P2 adds IndexedDB durability, resumable active time, personal records/statistics, backup validation and cross-tab coordination. No save-success claim or elapsed-time result is shown before that work exists. Hints, procedural generation, service-worker caching and deployment are still later phases.

## Requested design refinement

The 2026-10-24 request for sakura or jasmine blossoms on a Japanese-style twig/branch has been added to both source specifications for P5 mobile design polish. Prefer a quiet sakura branch on Home/Zen, using CSS or a tiny simplified SVG; keep it out of the board and action areas. No decorative asset has been added to P1.
