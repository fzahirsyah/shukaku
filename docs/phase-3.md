# Phase 3 — Solver and intelligent hints

Implementation date: 2026-10-24. Scope: PRD v1.3 P3, SOL-01–04/HINT-01 and storyboard SB-05/M15–M17.

## Delivered

### Solver

`js/engine/solver.js` enumerates in-bounds factor-pair rectangles that contain exactly one clue. It solves the resulting exact-cover problem with minimum-remaining-values clue selection, overlap rejection and uncovered-cell feasibility pruning. Placed regions are fixed constraints; local validation remains independent of the hidden answer.

The solver counts up to two completions and returns:

- `UNSOLVABLE`: exhaustive search found no complete partition.
- `UNIQUE`: exhaustive search proved exactly one partition.
- `MULTIPLE`: two complete partitions were found; further counting stops.
- `UNKNOWN`: cancellation or a node/work/time limit interrupted the proof.

Finding one solution before interruption does **not** prove uniqueness. A complete witness can establish consistency for Check Board, but cannot alone justify a reveal. The solver does not read the puzzle's stored canonical solution.

The engine exposes cooperative generators for production workers and a synchronous drain helper for deterministic unit checks. Pure callers can inject a clock; without one, node/work limits remain deterministic and the default clock does not advance. The production worker always supplies `performance.now()` for a real time budget.

### Worker and cancellation

`js/workers/puzzle-worker.js` runs Solve, Hint and Check requests in a module Web Worker. Work yields every 128 counted operations; processing yields to the worker event loop after approximately 6 ms, so cancellation messages can be handled. Each request also has finite work and search-node budgets.

Default worker limits are 1,600 ms, 100,000 search nodes and 1,000,000 counted operations. Worker inputs are clamped to maximum limits of 3,000 ms, 200,000 nodes and 3,000,000 operations. These are safety budgets, not a performance promise for every future large puzzle.

`PuzzleService` adds request IDs, cancellation, stale-message rejection and a 4,500 ms outer deadline. A stalled/failed worker is terminated; the next request can create a fresh worker. Unsupported workers produce an unavailable state while normal gameplay remains usable. No search is moved onto the UI thread as a fallback.

### Check Board and hints

The game now has a Check Board action plus a live Hint bottom sheet with Nudge, Explain and Reveal.

The hint engine first verifies that the current committed regions allow a complete solution. It then looks for:

1. A clue with one compatible rectangle.
2. An uncovered cell with only one covering candidate.
3. A rectangle proved forced by unique exhaustive completion, or by showing that excluding it makes completion impossible.

Nudge highlights the relevant clue without giving its complete bounds. Explain gives the deduction, dimensions and location without placing anything. Reveal uses the ordinary PLACE command and validator; it is undoable, respects existing regions and can complete a puzzle normally.

For a contradictory board, the engine checks that the original puzzle is solvable. Where a single-region removal permits a completion, it highlights that region and offers Review This Rectangle. If no single repair is proved within the budget, it gives general reconsideration guidance without blaming an unproven region. No rectangle is silently removed or rewritten.

A guaranteed move is not fabricated for ambiguous positions or interrupted analysis. The unavailable state offers retry and ordinary undo/play options.

### Integration and records

Hint requests are tied to a captured session ID, puzzle ID, board revision and request epoch. Closing the sheet, cancelling, navigating, backgrounding or entering a cross-tab conflict cancels pending work. Late responses cannot mutate the board or consume a hint.

Delivered Nudge/Explain hints and successful Reveal placements increment `hintsUsed`. Merely opening the sheet, Check Board, contradiction guidance, unavailable results and cancelled requests do not. Undoing a revealed rectangle does not remove the hint count. Assisted runs remain eligible for personal completion records and overall bests, while the separate no-hint best remains unmodified.

Classic timing pauses during analysis sheets and resumes when the player returns to play. Reveals made while paused use the same command/history/completion path, with elapsed time and hint usage persisted together. Existing save, backup and cross-tab safeguards remain in place.

Clue/region highlights use dashed outlines as well as color, with keyboard focus directed to the clue when requested. No layout redesign, generator, external service or decorative asset was added.

## Verification

The browser-runnable test page now contains **72** checks across gameplay, storage, timing, solver, hints and worker behavior. The solver agrees with the separate test-only enumerator on **all 462 positive-clue layouts on a 2×3 board**, including unsolvable, unique and ambiguous cases. All seven shipped tutorial/Classic/Zen definitions are independently checked and solved by the runtime engine.

Dedicated checks cover:

- Unsatisfiable/unique/multiple classifications and fixed-region constraints.
- Node/work/time interruption, cancellation and one-found-solution UNKNOWN behavior.
- Forced Reveal correctness without stored answers; repeated reveals finish every starter Classic level.
- Nudge/Explain non-mutation; contradiction preservation; no unproven reveal in an ambiguous board.
- Real worker operation, cooperative cancellation, main-thread responsiveness, unavailable workers, worker failure/recovery, outer deadline and stale response IDs.

Headless UI checks additionally verify persisted hint counts, double-click deduplication, undo/redo/reload of a revealed region, Check Board, highlighted contradiction review, an assisted completion excluded from no-hint records, and cancelled/unsupported/budget-limited analysis leaving the board and hint count unchanged.

Hint sheets and highlights were captured at 320×568, 360×800, 390×844 and 430×932. Fixed overlays use viewport captures to reflect the actual phone frame; sheets can scroll internally on short screens. Representative screenshots were visually inspected. The prior Phase 2 save/timer/backup/two-tab regression also passed on the integrated implementation.

Evidence: [Phase 3 results](qa/phase-3/results.json), [storage regression](qa/phase-3/storage-regression-results.json), [phone hint sheet](qa/phase-3/M15-hint-sheet-320.png), [contradiction guidance](qa/phase-3/M16-hint-contradiction-390.png), [unavailable hint](qa/phase-3/M17-hint-budget-320.png).

Browser checks used an isolated headless Chrome process and temporary local server. No user's screen, visible window or existing tabs were used. Nothing was installed or deployed.

## Remaining phases and acceptance

Physical-phone/Safari performance, assistive-technology review and visual approval remain manual release checks. Published puzzles remain the existing starter pack; this phase does not claim a full 30-level collection or calibrated generation difficulty.

P4 can reuse the worker-safe, bounded uniqueness counter for Endless Zen generation. It must accept only fully verified `UNIQUE` results and retain the ready-made fallback for timeout/failure. P5 remains offline/mobile release and the requested subtle sakura/jasmine branch design polish; P6 remains desktop refinement.
