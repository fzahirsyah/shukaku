# Audit fixes — 2026-10-24

All four findings from [the pending-work audit](/Users/farhan/Documents/Farhan/shukaku/docs/pending-audit.md) are addressed in code and the exercised checks. No site was deployed. Testing used isolated headless Chrome and local engine checks; the user's screen and existing browser data were not accessed.

## What changed

### Large generated histories

[Definition verification](/Users/farhan/Documents/Farhan/shukaku/js/state/definition-verifier.js) now uses 16-definition batches with fresh work/node/time budgets. Partial batches split and retry their unfinished definitions, including the one remaining definition after a partial response. A single limited proof stays pending rather than being declared invalid.

The controller serializes verification jobs, shows progress, supports cancellation and retries, and keeps pending records separate from corrupted records. Related pending sessions/results are retained for recovery export. A 60-second overall verification deadline bounds one operation; successfully verified definitions remain in memory for the next retry. Unsupported workers defer remaining work without looping or moving the solver to the main thread. Strict imports write nothing until every required definition is verified and the normal preview is confirmed.

Verified against the original failing fixtures:

- A valid 300-puzzle backup verifies, reaches confirmation and imports all 300 sessions on the first attempt.
- A valid 1,000-puzzle backup verifies and imports all 1,000 sessions on the first attempt.
- A local history of 1,000 sessions restores without a recovery warning, with `bulk-999` available to Continue.
- Cancelling restoration keeps the raw 1,000-session history, offers Retry, and completes without corruption warnings on retry.
- Import/reset operations invalidate stale refresh snapshots; a late proof cannot repopulate reset progress. Reset also clears pending recovery data in memory.

### Offline play and safe updates

[The service worker](/Users/farhan/Documents/Farhan/shukaku/service-worker.js) precaches the entire critical app shell: HTML, styles, local Vue, native modules, worker dependencies, curated puzzle data and small assets. [Offline support](/Users/farhan/Documents/Farhan/shukaku/js/state/offline.js) registers it only on suitable secure origins and reports actual readiness for that registration's scope, including subfolder hosting.

- An installation fails if any required asset is unavailable. The previous release/cache remains available.
- Updates wait naturally until all old game tabs close; there is no automatic `skipWaiting` or forced mid-game reload.
- Cache names include the app's scope path so root and subfolder installs cannot delete each other's caches.
- Navigations and known application assets use cached resources. Saved sessions remain in IndexedDB.
- If a critical cached resource has disappeared and cannot be fetched, a small reconnect page appears instead of a blank app. Reconnecting and reloading repairs missing resources.
- Registration/cache errors offer Retry. Settings indicates when offline setup is ready. An update notice explains when to close/reopen tabs.

Verified: offline repeat visit, Classic saved moves and hints, generated Zen creation/restoration without a timer, failed replacement install, successful multi-tab update, missing-module recovery, and root/subfolder cache isolation.

Offline revisit requires one successful online setup and available browser storage. Browser data clearing still removes local data/caches; exported backups remain the portable recovery path.

### Generation availability

The seeded partition algorithm, `zen-1` identity and logical rating ranges are unchanged, preserving saved definitions and replay. The default attempt allowance increases from 48 to 2,048, with a hard maximum of 4,096. Worker generation still has a real 2,800 ms default time limit, at most 6,000,000 operations and 200,000 nodes, cooperative yielding, cancellation and an outer deadline. Hints retain their previous default limits.

A timed-out or incomplete proof is never accepted. This increases the opportunity to find a valid candidate within the existing worker safety envelope rather than weakening uniqueness or changing a requested label.

| Seeded sample | Before | After |
| --- | ---: | ---: |
| 5×5 Challenging: requests without a generated puzzle | 1,200 / 1,300 (92.3%) | 1 / 101 (1.0%) |
| 12×12 Gentle: requests without a generated puzzle | 208 / 308 (67.5%) | 3 / 103 (2.9%) |
| Other 13 size/difficulty pairings | Various attempt-limit failures | 0 / 100 each |

The samples stop after 100 distinct accepted boards per pairing, with prior accepted fingerprints excluded. They are deterministic audit samples, not universal production probabilities or phone performance measurements. The three remaining 12×12 Gentle failures were work-budget limits; the one 5×5 Challenging failure was an attempt limit. All use the existing honest ready-made fallback.

A fresh set of **1,500 accepted puzzles** passed the independent uniqueness counter, structural validation and complete-solution checks, with no violations. Every tenth acceptance replayed/restored identically, and one example per pairing also replayed through the actual module worker.

### Mobile controls and sakura

Settings switches now have **46×44 px** button targets with the original smaller track drawn inside. Fit and other text buttons have a minimum width of 44 px. The captured controls meet the project's 44 px target at all six audited widths; board cells remain intentionally smaller in large-grid Fit view, with explicit zoom/pan.

The same static 1,375-byte sakura branch now appears in spare space on phone Home/Zen entry as well as wider screens. It does not change content flow, intercept input, animate or overlap the board. The 320 px Home and Zen captures were visually inspected.

![Phone Home with sakura](/Users/farhan/Documents/Farhan/shukaku/docs/qa/audit-fixes/320-home.png)

## Verification results

| Suite | Result |
| --- | --- |
| Browser engine/storage/solver/hint/worker harness | **79 / 79 passed**; includes 7 new verification tests |
| Independent generation gate | **1,500 / 1,500 accepted puzzles uniquely solvable**, 100 per advertised pairing |
| Main responsive/functional browser suite | **21 / 21 grouped checks passed** |
| Bulk-history reproduction suite | **5 / 5 passed** |
| Offline/update/subfolder suite | **7 / 7 passed** |
| Existing hint/completion/recovery regressions | **6 grouped checks passed**, no recorded page errors |
| JavaScript syntax and diff whitespace checks | Passed |

Fresh artifacts and optional local reproduction scripts are in [audit-fixes QA](/Users/farhan/Documents/Farhan/shukaku/docs/qa/audit-fixes). Original audit evidence is retained separately in `docs/qa/pending-audit`.

## Static handoff and limits

The static upload folder is `release/shikaku`; `release/shikaku-static.zip` contains its contents at the archive root. It includes runtime files and licenses, and excludes audit fixtures, screenshots and tests. No install or build command is required to use the package. Serve it through HTTPS (or a suitable localhost static server for local work), not `file://`.

Service-worker version `release-2026-10-24-3` must be bumped when a critical cached application resource changes; keep its precache list in sync when adding/removing runtime files. Update behavior was tested using controlled alternate worker versions on isolated local origins.

These results do not establish physical Android/iOS behavior, measured mobile frame rate, full screen-reader/contrast compliance or the eventual hosting provider's headers. Physical-device checks and a smoke test on the chosen HTTPS deployment remain release validation steps. No automatic deployment or production account changes were made.
