# SHIKAKU.

A quiet little puzzle. Mobile browser game built with Vue 3 and native browser APIs.

## Current milestone: Phase 4 implementation

Zen now requests seeded puzzles at 5×5, 6×6, 7×7, 10×10 or 12×12, with Gentle, Balanced and Challenging logical rating ranges. The worker accepts only proven unique puzzles that meet the chosen range. Generation has finite attempts, work, node and time budgets, cancellation and a clearly labeled ready-made fallback. Ratings are provisional pending human calibration; the P4 runtime acceptance gate has not yet been executed.

The game includes a Web Worker solver, Check Board, and Nudge/Explain/Reveal hints. Reveals are proved compatible with the current board, go through the normal move engine and remain undoable. Contradictions are explained without silently changing rectangles. Timeouts, cancellation and unavailable workers leave normal play intact.

Sessions, move history, preferences, hint counts and completion records save in native IndexedDB. Home offers Continue; restored Classic games open **paused**. The active-play clock excludes paused, hidden and closed time. Replays create independent attempts and preserve faster personal records, including a separate best without hints.

Core play includes touch drag, two-tap corners, keyboard navigation, validation, region editing, undo/redo, restart, pause and an interactive 4×4 tutorial. Three independently verified 5×5 Classic starter puzzles are included. Zen retains three verified 5×5 ready-made fallbacks. If the requested size cannot be generated, the fallback size and any repeat are labeled explicitly.

Settings supports portable JSON export, validated import with a preview, merge of new IDs only, confirmed replacement and a two-stage confirmed reset. Local data stays on this browser/device. There are no accounts, synchronization, SQL database or leaderboards.

## Run

Upload the static application folder to an existing HTTPS host, or use an already available static server. There is **no install or build step**. Opening `index.html` through `file://` is not supported because native modules and browser storage require a suitable origin.

Vue 3.5.22 is pinned and bundled locally. The game makes no external runtime requests. Service-worker caching and deployment remain scheduled for P5; This milestone does not claim offline revisit support or publish a site.

| URL suffix | Screen |
| --- | --- |
| `/#/` | Home and most recent resumable game |
| `/#/classic` | Starter levels, unlocks, personal bests and resume markers |
| `/#/play/classic/classic-beginner-001` | First Classic level; restores an unfinished attempt |
| `/#/zen` | Zen entry and Continue |
| `/#/play/zen/new` | Start a new ready-made Zen puzzle |
| `/#/settings` | Preferences, export/import, browser-storage protection and reset |
| `/#/stats` | Actual local attempts, completions and personal records |
| `/#/how-to-play` | Interactive tutorial |
| `/tests/index.html` | Browser-runnable engine, content, storage, backup and timer checks |

Zen URLs resolve to a stable session ID for later resumption. A separate Classic attempt uses an extra session ID segment; normally navigate through Home or level selection.

## Controls

- Drag between corners, or tap the first corner and then the opposite corner.
- Tap a placed rectangle for Change/Remove. Invalid replacements preserve the original.
- Use arrows to move cell focus, Enter/Space to choose corners, Escape to cancel, and Delete/Backspace to remove. One board cell participates in Tab navigation at a time.
- +/− zoom; explicit Draw/Pan changes gesture behavior. Fit/Reset restores the overview.
- Game Options pauses Classic. Returning from the background and restoring after reload both require Resume.
- Restart clears the current attempt's board and can be undone before completion; it keeps elapsed play time. Replay after completion starts a fresh attempt with a fresh clock.

## Hints and board checks

- Hint opens Nudge, Explain and Reveal choices. Nudge points to a clue; Explain describes a forced rectangle; Reveal places it.
- Check Board tests whether at least one complete solution remains. It does not claim every locally valid placement is the final answer.
- Contradiction guidance can highlight a rectangle to review; the player chooses whether to change or remove it.
- Delivered hints count toward assisted attempts. Opening/cancelling analysis, Check Board, unavailable results and contradiction guidance do not consume hints. Undo preserves prior hint usage.
- Classic timing pauses while the analysis sheet is open. Zen has no time pressure.
- Search runs off the UI thread with finite budgets. Late/cancelled replies cannot alter a different board or session.

## Save and recovery behavior

- Each committed command queues a complete session write. Writes serialize per session and validate the previously saved storage revision.
- A generated definition and its first session are committed atomically. Reload verifies unknown generated definitions in the worker before restoring their sessions. Unverified records remain available in recovery exports.
- Completion writes its result and completed session together, exactly once per attempt.
- The displayed save status reflects completed transactions. Failed saves keep the board in memory and offer Retry/Export. Navigation after failure asks whether to stay or continue without a confirmed save.
- Corrupted items are skipped without deleting the raw data; a recovery export is available.
- Web Locks, IndexedDB leases/revisions and BroadcastChannel coordinate tabs. A competing editor can reload after the original tab releases the game or explicitly start a separate attempt.
- Export includes required puzzle definitions, sessions, history, results and preferences. Imports support bundled v1 content and generated `zen-1` definitions. Unknown generated definitions are reconstructed from their seed and independently solved in the worker before the import preview. Custom puzzles and unsupported generator versions are rejected. Stored solutions and verification flags are never trusted as proofs.
- Browser data deletion, private browsing and eviction can remove local saves. Optional browser persistence is a request, not a replacement for backups.

## Structure

- `js/engine/`: validation, reversible commands, bounded exact-cover solver, forced-move hints, seeded generator and logical difficulty evaluation
- `js/workers/`: cooperative background solver/hint/check/generate/verification requests
- `js/state/puzzle-service.js`: worker lifecycle, request cancellation, deadlines and stale-message rejection
- `js/components/`: accessible board/input controller and shared icons
- `js/state/use-game.js`: screens' controller, asynchronous routing, saves and recovery
- `js/state/timer.js`: monotonic active-play clock and personal-record calculations
- `js/storage/`: native IndexedDB transactions, ownership, validation and backup contracts
- `js/data/`: curated starter content, tutorial and Zen fallbacks
- `js/app.js`: Vue screen and sheet templates
- `css/`: tokens, mobile layouts and motion preferences
- `vendor/`: pinned Vue runtime and license
- `tests/`: browser checks with no installation requirement
- `docs/`: PRD, storyboard, handoffs and QA evidence

Pending P4 acceptance: runtime/regression checks and independent uniqueness checks for 100 distinct accepted puzzles per supported tier. No tests or browser QA were run for this implementation step. Next after acceptance: P5 offline/mobile release and floral visual polish → P6 desktop refinement.

The requested Japanese floral branch motif (sakura preferred, jasmine alternative) remains recorded for **P5**, away from the board and controls.

See [PRD](docs/prd.md), [storyboard](docs/storyboard.md), [P0](docs/phase-0.md), [P1](docs/phase-1.md) and [P2](docs/phase-2.md) , [P3](docs/phase-3.md) and [P4](docs/phase-4.md).
