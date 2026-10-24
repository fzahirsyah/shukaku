# Phase 4 — Endless Zen

Implementation date: 2026-10-24. Scope: PRD v1.3 P4, GEN-01–02, ZEN-01 and storyboard SB-08.

Status: implementation delivered; runtime acceptance gate remains pending. JavaScript syntax was checked. No tests, browser automation or screen access were used for this step. Existing P0–P3 QA artifacts are historical evidence for those phases, not verification of P4.

## Generation

- All generation and solution counting run in a module Web Worker. The UI never drains the solver or generator.
- Sizes: 5, 6, 7, 10 and 12, default 5. Difficulty: Gentle, Balanced or Challenging, default Gentle.
- `seeded-random.js` supplies a deterministic integer PRNG using the full seed string. Generator version is `zen-1`.
- `puzzleFromSeed` starts with one full-board rectangle and recursively splits a randomly selected existing rectangle. This preserves complete coverage and disjoint regions. One area clue is placed within each region.
- Each attempt is separately seeded. The accepted candidate's seed, generator version, size and difficulty determine its definition and ID. Replaying that stored seed tries the same candidate first; it needs no failed-attempt history. Repeatability assumes the same generator version and parameters, sufficient budget and no exclusion of the requested board.
- The solution counter does not read the construction partition or any supplied solution. Only an exhaustive `UNIQUE` result can be accepted. `MULTIPLE` and `UNSOLVABLE` are rejected. `UNKNOWN` stops generation safely; one witness is never sufficient.
- Quality rejects candidates with fewer than four clues, more than 25% unit clues, or no clue with area at least four. Canonical solutions come from the independent solving stage.
- A clue-position/value fingerprint catches identical boards even under different seeds/IDs. The app excludes its most recent 2,000 known Zen definitions. It does not promise never to repeat an arbitrary lifetime history.

## Difficulty evaluation

The logical evaluator enumerates candidate rectangles, repeatedly removes candidates blocked by forced placements, and applies singleton-clue and sole-cell-cover deductions in rounds. It records initial candidate count, initial forced regions, deduction rounds, sole-cell deductions, logically resolved regions and unresolved regions.

The provisional score is:

`min(100, round(12 × log2(mean initial candidates) + min(30, 3 × deduction rounds) + 40 × unresolved fraction))`

Acceptance ranges are Gentle 0–30, Balanced 31–60 and Challenging 61–100. Dimension does not enter the score. Region-size distributions help propose candidates, but acceptance uses measured logical deductions and a separate uniqueness proof. Human playtesting and acceptance-rate calibration remain necessary; labels are not claims about solve times.

## Limits and cancellation

- Default: 48 attempts; worker accepts at most 64.
- Generation: 2,800 ms, 100,000 search nodes and 4,000,000 counted operations shared across all attempts, solving and difficulty evaluation.
- Restore/import verification requests: up to 4,000 ms and 6,000,000 operations; at most 1,000 definitions per request. Partial proofs cannot authorize remaining definitions.
- Worker input caps: 4,000 ms, 200,000 nodes and 6,000,000 operations for generation/verification. Existing hint/search limits are unchanged.
- Cooperative engine work yields every 128 operations; worker slices return to its event loop after approximately 6 ms. Wall-clock budgets include time between slices.
- Separate worker services isolate hints, generation and definition verification. Outer deadlines are 5,500 ms for generation and 6,000 ms for verification.
- Cancel, navigation, page hiding and teardown cancel generation. Request IDs, generation epochs and route checks reject late replies. Cancellation does not select a fallback or create a session.

These are safety limits, not measured performance or acceptance-rate claims.

## Fallbacks and interface

The existing three independently verified 5×5 fallback definitions retain their immutable IDs. No additional unchecked curated content was introduced.

Worker unavailability, an attempt limit, a proof limit or a worker error uses an unused ready-made puzzle first. When all three have been used, repeats are explicitly labeled. The board says READY-MADE PUZZLE, shows its actual size and explains when it differs from the requested size or difficulty. In particular, a requested 12×12 may fall back to 5×5; the app does not claim that fallback was generated or matched the requested rating.

The Zen entry offers size and difficulty controls, an accessible busy message and Cancel. Continue and recent completions display actual saved dimensions. Zen retains hints, restart, undo and automatic saving, with no clock or timed rankings.

## Persistence and portability

- The canonical registry contains bundled definitions plus definitions accepted by the worker.
- Claiming an attempt writes its definition and session in the same IndexedDB transaction, under the existing shared data lock. A failed write leaves temporary play in memory with the existing Retry/Export recovery flow.
- Puzzle ID collisions with different content or provenance abort the transaction.
- A generated definition loaded from IndexedDB or imported from JSON is reconstructed from its supported version and seed, compared with its clues/identity, solved for uniqueness and logically rated in the worker. Stored solution, `uniqueVerified` and score fields are not trusted.
- Session validation allows generated Zen definitions only after registration. Exports include full canonical definitions. Imports retain existing preview, merge/replace confirmation and atomic writes.
- Unsupported versions, altered clues and unverified records cannot silently become playable. Existing raw records are retained for recovery. A verification timeout can be retried; no main-thread solving fallback is used.
- Reset removes generated definitions as well as sessions/results, then restores bundled content.

Generation needs no network once application modules are loaded. Offline revisits still require the P5 cache/service-worker work.

## Pending acceptance

The PRD gate remains open: independently verify 100 distinct accepted puzzles per supported tier; cover every advertised size/difficulty pairing, deterministic replay, unknown/multiple/unsolvable rejection, cancellation, deadlines, worker failure, duplicate avoidance, fallback exhaustion, save/reload, generated import/export, conflicting tabs and input responsiveness. The existing `tests/content-verifier.js` is a separate implementation suitable for the independent uniqueness portion, but was not run or extended here.

No claim of passing that gate is made. The requested sakura/jasmine twig motif remains scheduled for P5 mobile design polish. Deployment, offline caching and desktop refinement remain in their planned phases.
