# SHIKAKU.

A quiet little puzzle. Mobile browser game built with Vue 3 and native browser APIs.

## Current status: audit fixes verified

The pending-work audit fixes are implemented: bounded chunked save verification, offline caching with safe updates, improved Zen generation availability and 44 px control targets. The sakura branch now appears on phone and wider Home/Zen screens. Headless checks passed: 79 harness tests, 21 browser groups, 5 bulk-history groups, 7 offline/update groups and a fresh 1,500-puzzle independent uniqueness sample.

The static handoff is `release/shikaku` or `release/shikaku-static.zip`. No site has been deployed. Physical-device and hosted HTTPS smoke checks remain. See [fix details](docs/audit-fixes.md).
Zen now requests seeded puzzles at 5×5, 6×6, 7×7, 10×10 or 12×12, with Gentle, Balanced and Challenging logical rating ranges. The worker accepts only proven unique puzzles that meet the chosen range. Generation has finite attempts, work, node and time budgets, cancellation and a clearly labeled ready-made fallback. Ratings are provisional pending human calibration; the independent uniqueness gate passes for all advertised size/difficulty pairings.

The game includes a Web Worker solver, Check Board, and Nudge/Explain/Reveal hints. Reveals are proved compatible with the current board, go through the normal move engine and remain undoable. Contradictions are explained without silently changing rectangles. Timeouts, cancellation and unavailable workers leave normal play intact.

Sessions, move history, preferences, hint counts and completion records save in native IndexedDB. Home offers Continue; restored Classic games open **paused**. The active-play clock excludes paused, hidden and closed time. Replays create independent attempts and preserve faster personal records, including a separate best without hints.

Core play includes touch drag, two-tap corners, keyboard navigation, validation, region editing, undo/redo, restart, pause and an interactive 4×4 tutorial. Three independently verified 5×5 Classic starter puzzles are included. Zen retains three verified 5×5 ready-made fallbacks. If the requested size cannot be generated, the fallback size and any repeat are labeled explicitly.

Settings supports portable JSON export, validated import with a preview, merge of new IDs only, confirmed replacement and a two-stage confirmed reset. Local data stays on this browser/device. There are no accounts, synchronization, SQL database or leaderboards.

## Run

Upload the static application folder to an existing HTTPS host, or use an already available static server. There is **no install or build step**. Opening `index.html` through `file://` is not supported because native modules and browser storage require a suitable origin.

Vue 3.5.22 is pinned and bundled locally. The game makes no external runtime requests. The service worker caches critical runtime assets after a successful online setup and supports offline repeat visits. Updates wait until old game tabs close; no site is published automatically.

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
- Tap a placed rectangle for Change/Remove, or double-tap the same cell in a placed rectangle to remove it. Removal can be undone. Double-tap an empty cell to cancel a corner/selection. A clue of 1 still supports choosing the same corner twice to place its one-cell rectangle. Invalid replacements preserve the original.
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
- `js/state/definition-verifier.js`: bounded, cancellable collection verification with pending-state recovery
- `js/state/offline.js` and `service-worker.js`: cache readiness, offline play and safe update lifecycle
- `js/workers/`: cooperative background solver/hint/check/generate/verification requests
- `js/state/puzzle-service.js`: worker lifecycle, request cancellation, deadlines and stale-message rejection
- `js/components/`: accessible board/input controller and shared icons
- `js/state/use-game.js`: screens' controller, asynchronous routing, saves and recovery
- `js/state/timer.js`: monotonic active-play clock and personal-record calculations
- `js/storage/`: native IndexedDB transactions, ownership, validation and backup contracts
- `js/data/`: curated starter content, tutorial and Zen fallbacks
- `js/app.js`: Vue screen and sheet templates
- `css/`: tokens, mobile base, tablet/desktop adaptations and motion preferences
- `vendor/`: pinned Vue runtime and license
- `tests/`: browser checks with no installation requirement
- `docs/`: PRD, storyboard, handoffs and QA evidence

P0–P6 implementation is present. Automated/headless acceptance is recorded in the fix report; physical-device checks, human difficulty calibration and hosted HTTPS release checks remain.

The requested Japanese floral branch motif is implemented as a 1,375-byte local sakura SVG on phone and wider Home/Zen entry screens. It is static, decorative and separate from the board and controls.

See [PRD](docs/prd.md), [storyboard](docs/storyboard.md), [P0](docs/phase-0.md), [P1](docs/phase-1.md) [P2](docs/phase-2.md), [P3](docs/phase-3.md), [P4](docs/phase-4.md), [P5](docs/phase-5.md) and [P6](docs/phase-6.md).

## Pending-work audit — 2026-10-24

The audit independently verified 1,500 distinct generated puzzles (100 for every size/difficulty pairing), passed the existing 72-check harness and exercised headless responsive/keyboard/save flows. Offline reload failed, and large valid histories exposed a shared verification-budget bug. Generation availability and small control targets also need improvement. See [audit findings and evidence](docs/pending-audit.md). Earlier milestone QA notes describe their state at implementation time.

Audit follow-up: the four findings above are addressed. See [verified fixes and static handoff](docs/audit-fixes.md); the earlier audit remains a record of the pre-fix behavior.

### Double-tap controls — 2026-10-24

Rapid taps on the same cell (within 320 ms and 24 CSS px) remove a placed rectangle through the ordinary undoable REMOVE command, or cancel an unfinished empty-cell selection. Rapid taps on different corners continue drawing normally. Single-cell clue placement, keyboard controls and locked/pan modes retain their existing behavior. JavaScript syntax was checked; no new runtime tests were run for this follow-up. The static package was refreshed and the cache version bumped.

### App icon — 2026-10-24

The supplied three-block logo is available as a scalable vector in `assets/app-icon.svg`, a rounded SVG/32 px browser favicon, an Apple 180 px home-screen icon, and 192/512 px app icons with a separate maskable variant. `manifest.webmanifest` provides optional install metadata; installation remains optional. All icon assets are included in offline caching and the refreshed static package.
