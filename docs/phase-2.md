# Phase 2 — Local progress

Implementation date: 2026-10-24. Scope: PRD v1.3 P2 and storyboard local-progress/recovery flows.

## Delivered

### Durable local progress

Native IndexedDB database `shikaku-db`, schema v1, contains `puzzles`, `sessions`, `results` and `settings` with the required indexes. Initial version-0 → version-1 creation is tested. No package or SQL dependency is used.

Every committed move queues a complete, serialized session snapshot. Engine revision tracks moves; `_storageRevision` separately protects asynchronous move/timer/settings-related session writes against stale snapshots. A transaction must finish before the app says the save is confirmed. Completion updates the session and inserts a stable `result:<sessionId>` record in one transaction; duplicate requests do not duplicate results.

Home and Zen entry find real resumable sessions. Classic tiles show completion, personal bests and active-attempt markers; completing a level unlocks the next available starter level across reloads. Replays create new attempt IDs, preserve prior results and start a fresh clock. The available content remains three Classic levels and three separately identified Zen fallbacks.

### Active time and records

`ActiveTimer` uses monotonic `performance.now()` intervals. Only accumulated elapsed duration is persisted, with a periodic 15-second checkpoint and checkpoints on moves, pause, navigation and visibility changes. Classic restores paused; backgrounding or an open sheet stops the clock until Resume. No elapsed clock or timed result appears in Zen.

Statistics derive from actual sessions/results: distinct completed Classic levels, progress by difficulty, attempts, completions, per-level best, no-hint best, last played date, recent history and Zen completion count. A slower replay cannot replace a faster personal best.

### Preferences and backups

Theme, reduced motion, high-contrast outlines, preferred selection style and sound preference persist. Actual sound feedback remains later polish. Settings also offers an optional browser-persistence request; the UI never claims it protects against deliberate site-data clearing.

Export creates a portable JSON file containing necessary definitions, sessions/history, results and settings, without tab ownership metadata. Import checks file size (5 MB maximum), format version, IDs, duplicates, content version, canonical puzzle definitions, local board validity, bounded history, timestamps and result/session consistency before any write. Active imported sessions become paused.

Import shows a preview and offers:

- **Merge:** add new IDs only; preserve existing attempts and preferences.
- **Replace:** explicitly type REPLACE, then atomically replace the four stores.

Reset requires a warning, a second step and the typed word RESET. Replacing/resetting refuses to run while another tab owns an editor. Invalid imports produce an explanation and make no partial writes.

Current imports support the bundled curated/fallback content. Unknown/generated/custom definitions are rejected until the later solver can independently validate them.

### Multiple tabs and recovery

Web Locks keep one editor per default Classic puzzle or explicit Zen/separate session. A shared data lock protects editors from destructive replacement/reset. IndexedDB leases provide a fallback when Web Locks are unavailable; optimistic revisions guard every write. BroadcastChannel propagates saved/released/data-change notices.

A competing tab pauses with Reload Current Save and Start Separate Session. The latter creates a distinct attempt and URL. Retrying a failed local snapshot cannot claim ownership and overwrite a newer saved revision silently.

Storage failures preserve in-memory play, expose Retry/Export in the affected screen or sheet and guard navigation when a save remains unconfirmed. IndexedDB-unavailable browsers can play temporarily with an explicit warning. Corrupted records are skipped, preserved in the database and exportable as recovery data; a clean attempt can be created without overwriting them.

## Verification

The no-install browser harness at `tests/index.html` now combines **40** engine/content/storage/timer/backup checks. Storage tests use an isolated temporary database and remove it afterward.

Coverage includes schema/index creation, write/read validation, stale revision rejection, active/expired leases, serialized saves, atomic/idempotent completion, transaction rollback, persistent settings, monotonic pause/reload timing, best/no-hint record calculations, backup round trips, malformed/incompatible data, duplicate IDs, merge idempotency, guarded replacement and reset.

Separate headless Chrome checks exercised:

- A real move and undo/redo history restored after reload.
- Paused/reloaded Classic clock remains frozen during time away.
- Completion saved once; Replay creates an independent attempt.
- Real Home Continue, statistics and persistent theme.
- JSON download, invalid-import rejection, merge, confirmed replace and two-stage reset.
- Two browser tabs contend for one game, then safely split into independent attempts.
- Home, Settings and game layout captures at 320×568, 360×800, 390×844 and 430×932 without horizontal overflow.
- Zen completion without timing and restored ready-made puzzle progress.
- Storage-disabled temporary play with truthful feedback.
- Injected quota failures retain the move in memory and exports, guard navigation and recover on retry.
- Corrupt-session recovery preserves raw data and allows another valid attempt.
- A newer externally written snapshot survives a stale retry.

Artifacts: [regression results](qa/phase-2/results.json), [recovery results](qa/phase-2/recovery-results.json), [paused restore](qa/phase-2/M09-restored-paused-390.png), [personal records](qa/phase-2/M29-real-statistics-390.png), [storage warning](qa/phase-2/M38-storage-unavailable-320.png), [tab conflict](qa/phase-2/M40-cross-tab-conflict-390.png).

All browser work ran in a separate headless process with a temporary local QA server; no user screen, visible window or existing tab was accessed. No tools were installed and no site was deployed.

## Remaining acceptance and boundaries

Physical-phone/Safari storage behavior, browser eviction/private-mode variations, screen-reader review and subjective visual approval still need manual device checks. A crash may lose time since the latest checkpoint; committed move writes are asynchronous and are marked unconfirmed until the transaction succeeds. Browser-local durability does not guarantee survival of cleared site data.

This is the initial schema. Future version upgrades must add explicit migrations and backed-up fixture tests; no unimplemented future migration is claimed here.

P3 adds the runtime solver and explainable hints. P4 adds bounded, uniqueness-verified Zen generation. P5 adds service-worker caching, final mobile/accessibility review, the requested subtle sakura/jasmine branch motif and static hosting release. P6 remains desktop refinement.
