# SHIKAKU — Product Requirements Document (PRD)

**Document version:** 1.3  
**Status:** Implementation-ready specification; no source code implemented yet  
**Product:** SHIKAKU — a mobile-first Japanese rectangle logic puzzle game  
**Primary platform:** Modern mobile browsers; desktop refinement comes last  
**Last updated:** 2026-10-24  
**Related document:** [`storyboard.md`](./storyboard.md)

---

## 0. Decision log — authoritative scope

This document **supersedes earlier plans**. The following choices are locked unless explicitly revised.

| Area | Decision | Consequence |
|---|---|---|
| Game modes | **Classic** and **Zen** | Shared rules engine; different progression and UI |
| Architecture | **100% static frontend** | No backend server, API, Worker endpoint, or database service |
| Framework | **Vue 3, browser-ready production build** | Locally bundled `vue.global.prod.js`; JavaScript components without a compilation step |
| Installation | **No npm, Node.js, Python, CLI, or runtime installation** | Open hosted HTTPS app in a browser; static file upload deployment |
| Persistence | **Native IndexedDB** | Device/browser-local saves, statistics, and settings |
| Shared data | **None** | No accounts, synchronization, shared rankings, or global leaderboard |
| SQL | **Not used** | No Cloudflare D1, SQLite WASM, SQL server, or SQL migrations |
| Hosting | **Cloudflare Pages static assets only** (recommended) | No Cloudflare Functions, `_worker.js`, D1 binding, or credentials |
| Art direction | Calm Japanese-inspired minimalism | System fonts, CSS geometry, small optimized SVG icons |
| Visual priority | **Mobile first; desktop last** | Validate 320–430 px screens before any desktop polish |
| Offline | Offline after a successful online load and cache installation | Service worker and local asset bundling; no PWA installation prompt required |
| Competitive features | Personal bests only | No leaderboard, online score upload, or rank |

**Terminology:** “No installation” means the player does not install an app and the developer does not install a toolchain to build or serve the product. A first visit over **HTTPS** is still necessary to load the hosted application. Directly double-clicking `index.html` via `file://` is **not** a guaranteed supported experience because browser module, IndexedDB, and service-worker behavior depends on origin/security policies.

---

## 1. Product overview

### 1.1 Vision

Build a lightweight, soothing Shikaku puzzle game that starts quickly, is delightful to touch, teaches itself, and lets players stop and resume without an account. Classic provides structured challenges and personal progress. Zen provides endless, unhurried puzzles with no performance pressure.

### 1.2 Value proposition

- **Easy to start:** Visit a URL, tap Classic or Zen, and play; no login and no app install.
- **Good on phones:** Touch-friendly board interactions, thumb-accessible controls, readable clues, and safe handling of tiny cells.
- **Consistent rules:** The same deterministic validator and win condition across all modes.
- **Reliable local progress:** Resume games and review personal results on the same browser/device.
- **Genuinely offline-capable:** Bundled application assets, curated puzzles, and local storage work after initial loading and caching.
- **Lightweight:** No background 3D, no large images, no complex SVG board, no external APIs.

### 1.3 Success criteria and target KPIs

These are **engineering/product acceptance targets**, not actual measurements.

| Metric | Initial target | Verification |
|---|---:|---|
| New user reaches first playable puzzle | ≤ 3 taps | Manual UX audit |
| First tutorial completion | Without outside instructions | Moderated/unmoderated usability sessions |
| No horizontal page overflow | 320–430 px phone width | Responsive QA matrix |
| Standard mobile gameplay | Target 60 FPS during drag | Browser performance inspection |
| Drag/selection preview latency | Target < 50 ms on reference phones | Manual instrumentation |
| Curated puzzle open after app load | Target < 300 ms | Performance logging |
| Save of committed move | Target < 500 ms in normal conditions | IndexedDB transaction timing |
| Solver and generator | No perceptible main-thread blocking | Worker stress tests |
| Correct completion detection | 100% of engine test fixtures | Browser-based test harness |
| Offline repeat visit | Successful after an online preload | Airplane-mode test |

### 1.4 Audience and use cases

- **Casual mobile player:** Plays for 2–10 minutes, wants to resume instantly.
- **Puzzle enthusiast:** Wants increasingly challenging, uniquely solvable puzzles and useful hints.
- **Relaxation player:** Prefers Zen, no visible clock, minimal interruption.
- **Returning player:** Wants the same state and their own best times on the same device.

### 1.5 Non-goals

No multiplayer, global or local *leaderboard UI*, friend system, online account, cloud synchronization, D1, SQLite, backend, monetization, advertisements, live events, push notifications, daily server content, social sharing service, complex content management, or native mobile binary. No guarantee that browser-local saves survive deliberate browser-data deletion or automatic eviction.

---

## 2. Product information architecture

### 2.1 Routes

Use **hash-based navigation** with a minimal custom router to avoid both a Vue Router package dependency and Cloudflare SPA rewrite configuration.

| Route | Screen | Notes |
|---|---|---|
| `#/` | Home | Continue, Classic, Zen, tutorial |
| `#/classic` | Classic level select | Categories and local progress |
| `#/play/classic/:levelId` | Classic puzzle | Curated immutable level |
| `#/zen` | Zen entry | Continue or new puzzle, choose size |
| `#/play/zen/:sessionId` | Zen puzzle | Generated or fallback puzzle |
| `#/stats` | Personal statistics | Device-local results |
| `#/settings` | Settings and data controls | Sound, motion, export, import |
| `#/how-to-play` | How to play | Rules and guided 4×4 fixture |

All routes must work after refreshing the static hosted page. Unknown routes redirect to Home with a non-blocking message.

### 2.2 Navigation principles

Home is the entry point. Each game has a clear Back action and a confirmation only if relevant actions could discard state. Resume is shown when an active save exists. The level selector never hides the existence of locked levels. Back and route changes auto-save first. The browser Back button remains predictable.

### 2.3 Initial content pack

Ship **30 hand-curated and independently verified Classic puzzles**, provisionally allocated as:

| Difficulty | Grid | Levels | Progression |
|---|---|---:|---|
| Beginner | 5×5 | 10 | First unlocked; later levels sequential |
| Easy | 6×6 | 8 | First unlocked; later levels sequential |
| Medium | 7×7 | 6 | First unlocked; later levels sequential |
| Hard | 10×10 | 4 | First unlocked; later levels sequential |
| Expert | 12×12 | 2 | First unlocked; later levels sequential |
| **Total** | | **30** | |

This distribution is the content-production target; **do not invent puzzles merely to fill the count**. A puzzle is publishable only after solver verification confirms one unique solution. New players may enter the first level of any difficulty; completing a level unlocks the next level within that difficulty. Previously completed levels remain replayable.

Level IDs are stable (for example `classic-beginner-001`) and include `contentVersion` for save compatibility. Difficulty labels must be checked through logical evaluation and human playtesting; dimension alone does not prove difficulty.

---

## 3. Shikaku rules and gameplay contract

### 3.1 Formal rules

Given an `R × C` cell grid with positive integer clues:

1. Partition **every cell** into axis-aligned, non-overlapping rectangles.
2. Each rectangle contains **exactly one clue**.
3. A rectangle's **area (height × width)** equals its contained clue.
4. Every clue belongs to exactly one rectangle.
5. A completed board has no uncovered cells and no overlaps.

The sum of clue values must equal `R × C` for any valid complete puzzle; reject data that violates this invariant.

### 3.2 Tutorial fixture — verified unique solution

Use this exact **4×4 tutorial/test fixture**, tested by enumerating valid rectangle assignments:

```text
Starting puzzle:           Solution regions:
+---+---+---+---+          +---+---+---+---+
|   | 4 |   |   |          | A | A | A | A |
+---+---+---+---+          +---+---+---+---+
| 2 |   | 6 |   |          | B | C | C | C |
+---+---+---+---+          +---+---+---+---+
|   |   |   |   |          | B | C | C | C |
+---+---+---+---+          +---+---+---+---+
|   | 3 |   | 1 |          | D | D | D | E |
+---+---+---+---+          +---+---+---+---+
```

Zero-based clue coordinates and solutions:

| Clue ID | (row, col, value) | Solution (row, col, height, width) |
|---|---|---|
| `t4-a` | `(0,1,4)` | `(0,0,1,4)` |
| `t4-b` | `(1,0,2)` | `(1,0,2,1)` |
| `t4-c` | `(1,2,6)` | `(1,1,2,3)` |
| `t4-d` | `(3,1,3)` | `(3,0,1,3)` |
| `t4-e` | `(3,3,1)` | `(3,3,1,1)` |

Solver fixture expectation: exactly **one** solution.

### 3.3 Selection and rectangle placement

**Primary gesture — drag:** Touch or mouse down on an empty cell, drag to a second cell, then release. The inclusive bounding rectangle is previewed during motion and validated on release.

**Accessible mobile alternative — two taps:** Tap a start cell, then tap an end cell to propose the same inclusive rectangle. This is always available, including zoomed boards; Cancel/Escape clears the anchor.

**Existing rectangle:** Tap its region to select it; show **Change** and **Remove** actions. Change starts a new selection for that clue; successful placement atomically replaces the old rectangle. If the replacement is invalid, the old region is preserved. This avoids a hidden long-press requirement.

**Invalid preview:** Draw a visible outline, explain the cause in a short non-blocking message, and make no state change. Do not rely on red/green alone to express validity.

### 3.4 Move validation sequence

Given `{row, col, height, width}`:

1. All coordinates and dimensions are integers; dimensions are positive and rectangle stays in bounds.
2. Compute area = `height × width`.
3. Enumerate clues contained in the rectangle; require exactly one.
4. Require that clue's value equals the area.
5. Check cell overlap with all committed regions, excluding the region being replaced.
6. If valid, commit as one reversible command; otherwise return a typed reason and leave the board unchanged.

Result codes: `OK`, `OUT_OF_BOUNDS`, `BAD_DIMENSIONS`, `NO_CLUE`, `MULTIPLE_CLUES`, `WRONG_AREA`, `OVERLAP`, `SESSION_LOCKED`.

**Important:** A locally valid placement need not be part of the puzzle's unique final solution. Do **not** mark it incorrect just because it differs from the stored answer. `Check board` and hints may diagnose a globally unsolvable intermediate arrangement.

### 3.5 Victory detection

After each successful command, check: assigned region count equals clue count; all regions satisfy local validation; each cell is covered exactly once; no cell remains uncovered. On success, lock the game state against additional moves, persist completion, and open the result screen. A mere count of placed rectangles is **not** sufficient.

### 3.6 Actions and state transitions

- `PLACE`: create a new region for an unassigned clue.
- `REPLACE`: atomically replace the region belonging to a clue.
- `REMOVE`: remove one selected region.
- `UNDO`: reverse last committed command (bounded history of 100).
- `REDO`: reapply undone command. Any new command after undo clears redo history.
- `RESTART`: clear current board; confirm if moves exist; retain the puzzle definition.
- `PAUSE`: Classic only; freeze active timer and disable input until resume.
- `HINT`: present a logical hint; full reveal placement uses the same engine commit mechanism.
- `COMPLETE`: write a local result exactly once and show result sheet.

Game state labels: `LOADING → PLAYING ↔ PAUSED → COMPLETED`; `ERROR_RECOVERABLE` is reachable on storage or generation failure. A transient gesture is `IDLE`, `ANCHORED`, `DRAGGING`, or `REGION_SELECTED` and is never stored.

---

## 4. Classic mode

### 4.1 Player experience

Classic uses immutable curated levels, visible personal completion status, active-play time, and personal best records. No leaderboard, competitive rankings, scores from other people, or global status.

### 4.2 Timer specification

- Display `MM:SS`, switching to `HH:MM:SS` for longer sessions.
- Measure active gameplay with monotonic elapsed time while visible, storing accumulated `elapsedActiveMs` only at checkpoints.
- Pause on menu pause, `visibilitychange → hidden`, or navigation away from the game; resuming starts a new active interval.
- Reload restores the session in **paused** state so time away never counts.
- Clock changes and timezone changes do not affect elapsed active time.
- A replay of a completed level starts a new attempt; the fastest completed elapsed time remains its personal best.

### 4.3 Personal records

Display completion badge, best time, best completion with no hints, number of attempts/completions, and last-played date. **No cross-device synchronization.** Replays must never overwrite a faster personal best with a slower time.

### 4.4 Hints in Classic

Hints are always available and counted in `hintsUsed`; hint-assisted runs remain eligible for a *local* completed record, but a separate `bestNoHintTimeMs` is maintained so assisted and unassisted performance is not misleading. No online score upload.

---

## 5. Zen mode

### 5.1 Player experience

Zen removes the timer and scores from the interface and offers **Endless Play**, choosing a board size/difficulty and requesting a locally generated unique puzzle. Zen always allows undo, hints, restart, and auto-save.

### 5.2 Puzzle continuity

- `Continue`: resumes the most recently active Zen session.
- `New puzzle`: creates a new session and keeps its generated puzzle definition in IndexedDB.
- `Next puzzle`: starts another unique generated puzzle, preserving the completed result locally.
- Zen results track completion count and optional history but **do not display rankings or time pressure**.

### 5.3 Graceful generation fallback

If a Web Worker is unsupported or a generation budget is exceeded, use a **preverified curated Zen fallback puzzle** (with its own immutable ID). The UI says “Opening a ready-made puzzle” rather than claiming it was generated. If the fallback collection has been exhausted, reuse is allowed but label repeats transparently; never present an ambiguous or unchecked puzzle.

---

## 6. Logic engine and algorithms

### 6.1 Architectural rule

Engine functions are pure JavaScript modules, without direct DOM, Vue, `window.localStorage`, or IndexedDB dependencies. UI components call services/stores; services call engine functions. Solver/generator live in a dedicated Web Worker. This is both testable and responsive on phones.

### 6.2 Canonical data shapes (contracts, not implementation)

```text
Clue = { id: string, row: integer, col: integer, value: integer }
Rectangle = { clueId: string, row: integer, col: integer,
              height: integer, width: integer }
Puzzle = { id, contentVersion, rows, cols, difficulty, modeSource,
           clues: Clue[], uniqueVerified: boolean,
           solution?: Rectangle[], seed?: string,
           generatorVersion?: string, logicScore?: number }
Session = { id, puzzleId, mode, status, rectangles: Rectangle[],
            undoStack, redoStack, elapsedActiveMs, hintsUsed,
            startedAt, updatedAt, completedAt?, revision }
```

Coordinates are zero-based and row-major. Rectangle `height`/`width` are cell counts, not pixels. Puzzle definitions are immutable; only sessions change.

### 6.3 Solver specification

**Goal:** Count solutions up to 2 and (when unique) return a canonical complete partition.

1. Validate puzzle structure and clue sum.
2. For each clue value `N`, iterate positive factor pairs `(h,w)` with `h×w=N`.
3. Generate every in-bounds rectangle of that size containing its clue and **no other** clue.
4. Solve as a constrained exact-cover problem: each clue receives exactly one candidate and every board cell belongs to exactly one candidate.
5. Choose the unassigned clue with the fewest currently compatible candidates (MRV heuristic).
6. Place candidate, reject overlaps and impossible uncovered cells, recurse, and backtrack.
7. Stop after finding two solutions, or when a resource/cancellation limit is reached.

Return one of:

- `UNSOLVABLE`: search exhausted; 0 complete solutions.
- `UNIQUE`: search exhausted or sufficiently proved; exactly 1 solution.
- `MULTIPLE`: 2 or more complete solutions found.
- `UNKNOWN`: search interrupted/limited; cannot certify uniqueness.

Never publish a generated puzzle classified `UNKNOWN`, `MULTIPLE`, or `UNSOLVABLE`. Tests need unsolvable, unique, multiple, and timeout/cancel fixtures.

### 6.4 Generator pipeline

1. Choose allowed grid dimensions and a seeded PRNG (`seed` and `generatorVersion` both recorded).
2. Construct an exhaustive, non-overlapping rectangle partition.
3. Select one clue location per rectangle and set its value to that rectangle's area.
4. Check clue sum and all structural invariants.
5. Call the solution-counting solver; accept only `UNIQUE`.
6. Measure deduction complexity and compare with requested difficulty range.
7. Reject or retry if quality criteria fail.
8. Persist accepted puzzle and create a new Zen session.

**Worker safety:** Generate off the UI thread with a hard attempt budget and cancellation message. Check cancellation inside expensive loops. Provide a worker failure/timeout fallback path. Repeated seed + generator version must reproduce the same puzzle definition. Use deterministic IDs so accidental duplicates can be recognized.

**Constraint:** Unique-solvability alone does not prove an enjoyable puzzle. Calibrate difficulty based on candidate count, forced regions, and logical deduction chains; later adjust with human testing.

### 6.5 Logical hints

| Strength | Behavior | Commit board change? |
|---|---|---|
| Nudge | Highlight a clue/cell with an explainable deduction | No |
| Explain | Show excluded candidate logic and likely rectangle dimensions | No |
| Reveal | Place one guaranteed correct region when consistent with current state | Yes |

First test whether the current partial board remains solvable. If not, explain that some previously placed region needs reconsideration, optionally highlighting a problematic choice. Do not provide a contradictory placement or silently rewrite the player's board. Keep hint logic independent of the stored canonical solution wherever a logical explanation can be produced.

### 6.6 Undo/redo algorithm

Use reversible commands `{type, before, after, timestamp}` referencing the affected clue ID. `RESTART` can store a board snapshot once (subject to bounded history). Undo/redo changes are committed synchronously to memory and asynchronously saved to IndexedDB. Ignore repeated pointer-release events with a transaction/move token to prevent double commits.

---

## 7. Data persistence — native IndexedDB

### 7.1 Database and stores

Database: **`shikaku-db`**, initial schema version **1**. Use the native browser IndexedDB API; an `idb` or SQLite package is **not required**.

| Object store | Key | Indexes | Content |
|---|---|---|---|
| `puzzles` | `id` | `modeSource`, `difficulty` | Curated/generated puzzle definitions |
| `sessions` | `id` | `puzzleId`, `mode`, `status`, `updatedAt` | Active/paused/completed session snapshots |
| `results` | `id` | `puzzleId`, `mode`, `completedAt` | Local completion records and bests derivation |
| `settings` | `key` | None | `{key, value}` preferences |

Use `Date.now()`/ISO timestamps for history ordering; use monotonic clocks only to measure active duration. IndexedDB operations must be awaited/observed and failures shown to the user rather than silently swallowed.

### 7.2 Autosave and durability

- On each successfully committed command, immediately queue a write for the complete session snapshot.
- Serialize writes per session and attach `revision` to avoid stale out-of-order saves.
- Periodically checkpoint a Classic timer during active play (e.g. every 15 seconds) and on pause/visibility change.
- On startup, load preferences and the most recent resumable session.
- On completion, atomically create a result and update the session to `completed`; use an idempotent completion key to prevent duplicates.
- On schema upgrades, implement `onupgradeneeded` migrations with preflight tests on backed-up fixture data.
- Support optional `navigator.storage.persist()`; success is browser-dependent, not guaranteed.
- Warn that site-data clearing, private browsing, or storage eviction can remove local progress.

### 7.3 Cross-tab concurrency

Only one tab should be the active editor of a session. Use `BroadcastChannel` where available to announce active edit ownership and saved revisions; verify revision before accepting subsequent saves. If another tab updates the same session, pause the stale tab and offer Reload Current Save or Start Separate Session. Never silently overwrite a newer snapshot.

### 7.4 Export / import backup

Provide `Export Save` and `Import Save` in Settings. Export a small JSON file with `exportFormatVersion`, timestamp, settings, puzzle definitions required by saved sessions, sessions, and results. Import validates version, schema, dimensions, clue sums, and IDs before writing. Offer a preview plus **merge** (new IDs only) or **replace** (with explicit confirmation). Do not ingest scripts or remote content; display text via safe DOM rendering.

### 7.5 Storage failure behavior

If IndexedDB is disabled/unavailable/quota-limited, offer **temporary play in memory**, with a clear “Progress will not be saved” banner. Provide export when possible. Do not claim autosave success until the transaction completes.

---

## 8. UX, accessibility, and mobile-first performance

### 8.1 Mobile screen targets

Implement and validate in this order: **320×568**, **360×800**, **390×844**, **430×932**, tablet **768×1024**, then desktop **1440×900**. Support both light and dark themes. Portrait is primary; landscape is usable.

- Board uses the maximum practical width while preserving square cells and visible grid boundaries.
- Controls have at least **44×44 CSS pixel** hit boxes where feasible.
- The bottom action bar remains accessible above OS safe areas using `env(safe-area-inset-bottom)`.
- Avoid persistent sidebars on phones; use bottom sheets for hints/results/settings.
- Use `100dvh` where supported, with sensible fallbacks. Prevent accidental horizontal scrolling.
- Prevent browser text selection or page pan **inside active board gestures** without breaking scrolling elsewhere.

### 8.2 Handling 10×10 and 12×12 boards

On a 320 px phone, fitted cells are smaller than comfortable touch targets. **Do not pretend that shrinking the board is enough.** Provide:

1. A full-board Fit view for overview.
2. Explicit `+` and `−` zoom buttons; zoomed board inside a bounded pannable viewport.
3. Two-tap corner selection as a precise alternative to long drags.
4. A clear Reset View control and maintained selection anchor across pan.
5. Always-visible logical region borders and readable clue typography at zoomed scale.

Native pinch-to-zoom can be deferred; it must not conflict with rectangle drawing if later added.

### 8.3 Accessibility

- Visible focus indicators and keyboard focus management after route changes/modals.
- Keyboard navigation: arrow keys move focus across cells; Enter/Space marks first corner, then second; Escape cancels; Delete removes selected region.
- Text status announcements (`aria-live`) for invalid placements, hints, pause, and success.
- Color is never the sole indicator of filled/invalid/selected state; use borders, patterns, labels, or icons.
- Conform to the spirit of WCAG 2.2 AA: contrast, target size, reduced motion, semantics, and keyboard access.
- Respect `prefers-reduced-motion`; turn off decorative animation while retaining essential interaction feedback.
- Use system fonts and avoid forced page zoom prevention.

### 8.4 Asset and loading budget

- Render grid cells and filled regions with **HTML/CSS Grid and a positioned region layer**; **do not render the complete board as an SVG**.
- SVG is only for simple UI icons, ideally < 1 KB per icon and < 3 KB for any small illustration; simplify paths and avoid filters, masks, embedded raster images, and elaborate gradients.
- SVG is vector-based: “low-res SVG” means **low complexity/file size**, not pixelated rendering.
- Use CSS gradients/solid colors for backgrounds. Avoid large PNGs, hero photos, 3D libraries, and downloadable webfont families.
- Bundle `vue.global.prod.js` locally so no CDN request is required after initial deployment.
- Target a small total application transfer; measure actual compressed sizes rather than assuming icon targets guarantee a small bundle.

### 8.5 Motion

Default animation durations: hover/press 100–140 ms, region placement 150–220 ms, route change 200–280 ms, completion accents 500–800 ms. Move preview follows pointer without expensive DOM churn. Calm Zen ambiance may use a very slow, low-contrast CSS animation (optional); stop it under reduced-motion preference and low-power conditions.

---

## 9. Zero-install technical implementation

### 9.1 Browser-only Vue strategy

Use **Vue 3 production global bundle** as a local static file, loaded before `app.js`. App modules may use native ES modules referencing `window.Vue`, with template strings or render functions instead of `.vue` SFC compilation. Component templates are pre-authored strings and not produced from untrusted user input. No npm, no bundler, no transpiler, and no on-the-fly JSX compilation.

Use a minimal hash-based router and a lightweight reactive store based on Vue's built-in reactivity; Pinia and Vue Router are **not mandatory dependencies**. This eliminates avoidable packages while retaining clean component boundaries.

### 9.2 Proposed file structure

```text
shikaku/
├── index.html
├── manifest.webmanifest               # optional PWA metadata; no install required
├── service-worker.js                  # offline static cache, HTTPS only
├── css/
│   ├── tokens.css
│   ├── base.css
│   ├── mobile.css
│   └── motion.css
├── vendor/
│   └── vue.global.prod.js            # prebuilt, pinned local dependency
├── js/
│   ├── app.js
│   ├── router.js
│   ├── state/
│   │   ├── game-state.js
│   │   └── preferences.js
│   ├── components/
│   │   ├── home-screen.js
│   │   ├── level-select.js
│   │   ├── puzzle-board.js
│   │   ├── region-layer.js
│   │   ├── game-toolbar.js
│   │   ├── hint-sheet.js
│   │   ├── completion-sheet.js
│   │   ├── zen-screen.js
│   │   ├── stats-screen.js
│   │   └── settings-screen.js
│   ├── engine/
│   │   ├── types.js
│   │   ├── validator.js
│   │   ├── moves.js
│   │   ├── solver.js
│   │   ├── generator.js
│   │   ├── hint-engine.js
│   │   └── seeded-random.js
│   ├── workers/
│   │   └── puzzle-worker.js
│   ├── storage/
│   │   ├── indexeddb.js
│   │   ├── migrations.js
│   │   └── backup.js
│   └── data/
│       ├── classic-levels.js
│       └── zen-fallback-levels.js
├── assets/
│   └── icons/                         # optimized tiny SVG only when necessary
├── tests/
│   ├── index.html                     # browser-runnable test harness
│   ├── engine-tests.js
│   ├── storage-tests.js
│   └── fixtures.js
└── docs/
    ├── prd.md
    └── storyboard.md
```

All required resources are local to the deployment; no external runtime fetch is needed. `classic-levels.js` and fallback puzzles are preloaded or cached as static files. Client-side generated puzzles persist in IndexedDB.

### 9.3 Deployment and offline behavior

1. Prepare the static files in a folder; **no install/build commands**.
2. Create a static Cloudflare Pages project and upload the folder using supported dashboard/static asset upload flows.
3. Access the resulting HTTPS origin and run a first-load smoke test.
4. Register `service-worker.js` in that secure origin; precache critical app shell and curated puzzle resources.
5. On subsequent visits, load cached app shell offline; IndexedDB provides local sessions and generated puzzles.
6. Version the service-worker cache. Avoid deleting old caches before the new critical assets have installed successfully. Define behavior for storage failure and update-in-progress.

The user **does not have to install the PWA** to play. Optional Add to Home Screen is a convenience only, not a prerequisite. Static Cloudflare Pages hosting has **no D1, Worker API, Forms, Functions, secret token, or SQL**.

---

## 10. Privacy, security, and resilience

- All personal play data stays on the current browser/device unless the player explicitly exports it.
- No account identifier, nickname, IP collection endpoint, third-party trackers, advertisements, cookies for tracking, or telemetry by default.
- Treat imported backup JSON as untrusted data; validate shape, size, dimensions, clue values, and array bounds. Do not evaluate imported text.
- Content security policy may restrict scripts to self; keep inline scripting out of HTML where possible.
- Never assume the saved solution is secret/anti-cheat-protected; there is no competitive online system requiring this.
- Support storage-disabled browsers gracefully and avoid false “Saved” notifications.
- Handle corrupted saves, worker failure, backgrounding, orientation changes, aborted drag, and missing cached resources without crashing the game.

---

## 11. Testing and QA — no installation required

### 11.1 Tooling

Use a **browser-runnable unit-test page** (`tests/index.html`) plus manual responsive/mobile QA with browser developer tools and physical phones. No Playwright, npm, CI runner, or external test service is required for the project baseline. Test automation can be added later **only if explicitly approved**, without changing the no-install release path.

### 11.2 Unit/invariant test set

| ID | Test | Expected outcome |
|---|---|---|
| `VAL-01` | Valid 2×3 region for clue 6 | Accept |
| `VAL-02` | Area does not match clue | Reject `WRONG_AREA` |
| `VAL-03` | Rectangle contains zero clues | Reject `NO_CLUE` |
| `VAL-04` | Rectangle contains two clues | Reject `MULTIPLE_CLUES` |
| `VAL-05` | Region leaves grid bounds | Reject `OUT_OF_BOUNDS` |
| `VAL-06` | Region overlaps another committed region | Reject `OVERLAP` |
| `VAL-07` | Invalid replacement | Original region unchanged |
| `WIN-01` | Correct 4×4 tutorial solution | Complete once |
| `WIN-02` | One cell uncovered | Not complete |
| `UNDO-01` | Place → undo → redo | Exact board restored |
| `UNDO-02` | Undo then new placement | Redo stack cleared |
| `SOL-01` | Verified 4×4 fixture | Exactly 1 solution |
| `SOL-02` | Contradictory fixture | `UNSOLVABLE` |
| `SOL-03` | Ambiguous fixture | `MULTIPLE` |
| `SOL-04` | Budget exceeded | `UNKNOWN` not unique |
| `GEN-01` | Accepted generated puzzle | Unique, covered, valid |
| `GEN-02` | Same seed and generator version | Identical puzzle |
| `SAVE-01` | Commit move and reload | State restored |
| `SAVE-02` | Duplicate completion signal | One result only |
| `SAVE-03` | IndexedDB unavailable | Warning and temporary-play mode |
| `TIME-01` | Classic hidden/reloaded | Off-screen time excluded |
| `ZEN-01` | Zen completion | No timed ranking/score displayed |
| `OFF-01` | Second visit in airplane mode | Game and cached puzzles work |

### 11.3 Screenshot acceptance matrix

At **320×568, 360×800, 390×844, 430×932** first, capture: Home, level selection, Classic board idle, anchored selection, drag preview, invalid move feedback, paused Classic, Zen board, hint sheet, completion sheet, settings, storage warning, and dark mode. Then repeat representative screens on tablet and desktop. Screenshot comparison is against [`storyboard.md`](./storyboard.md), not a subjective last-minute redesign.

### 11.4 QA definitions

- **P0 blocker:** unsolvable published puzzle, false completion, lost save with false success indicator, broken core touch input, severe mobile overflow, or app fails offline after a confirmed successful cache.
- **P1 blocker before full release:** inaccessible primary game controls, broken hint consistency, reproducibility failure, inaccurate active timer, silent import corruption, or severe performance regression on supported mobile devices.
- **Polish backlog:** nonessential animation, large-screen decorative layout, optional extra themes, optional statistics visualizations.

---

## 12. Phased implementation plan and explicit gates

| Phase | Scope | Deliverables | Release gate |
|---|---|---|---|
| **P0 — Mobile storyboard shell** | Static Vue, tokens, routes, six principal screens | Navigable mobile UI with dummy content and optimized assets | No overflow at 320/360/390/430; approved storyboard screenshots |
| **P1 — Core play** | Grid, input, validation, undo/redo, restart, tutorial | Fully playable verified 4×4 tutorial plus starter Classic pack | All `VAL-*`, `WIN-*`, `UNDO-*` tests pass; touch-only completion |
| **P2 — Local progress** | IndexedDB, resume, timers, results, settings | Functional Classic progression + Zen interface on curated fallback content | Save/reload, pause timing, corruption handling pass |
| **P3 — Solver and hints** | Exact-cover worker solver, contradiction handling, explainable hints | Verified logical engine and hint sheets | `SOL-*` tests pass; no contradictory hints |
| **P4 — Endless Zen** | Seeded generator, uniqueness filter, difficulty analysis, fallback | Offline locally generated Zen puzzles | 100 distinct candidates per supported tier pass independent uniqueness checks; timeouts safe |
| **P5 — Offline and mobile release** | Service worker, backups, small-asset pass, accessibility | Upload-ready static folder | `OFF-*` passes; mobile QA passes; critical assets available offline |
| **P6 — Desktop last** | Wide-screen layout and enhanced keyboard polish | Responsive desktop refinement | 768/1440 acceptance without regression on mobile |

**The 100-puzzle check is a validation sample, not a promise that every randomly sampled candidate is accepted or fast to produce.** Generate and test accepted results within an explicit offline QA batch; reject ambiguous and timeout candidates.

A phase is complete only when its test gate is documented as passed. “Screen looks right” does not substitute for functional acceptance.

---

## 13. Traceability: requirements → screens → tests

| Requirement | Storyboard reference | Tests |
|---|---|---|
| Fast mode selection | `SB-01` | UX-01 |
| Classic level selection/progress | `SB-02` | PROG-01 |
| Mobile play and draw | `SB-03`, `SB-04` | VAL-01–07 |
| Undo/redo and pause | `SB-03`, `SB-06` | UNDO-01–02, TIME-01 |
| Hints and contradiction handling | `SB-05` | SOL-01–04, HINT-01 |
| Win and personal best | `SB-07` | WIN-01–02, SAVE-02 |
| Endless Zen | `SB-08` | GEN-01–02, ZEN-01 |
| Local stats | `SB-09` | SAVE-01 |
| Settings, export/import | `SB-10` | SAVE-03, IMPORT-01 |
| Tutorial accessibility | `SB-11` | WIN-01, A11Y-01 |
| Offline/error handling | `SB-12` | OFF-01, SAVE-03 |

---

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tiny 12×12 cells on mobile | Mistaps | Zoom/pan + two-tap corners + clear selected boundaries |
| Generator too slow on phones | UI freeze | Dedicated Worker, finite budgets, verified fallback content |
| Generator creates ambiguous puzzle | Broken experience | Independent 0/1/2 solver; publish only `UNIQUE` |
| Browser storage deleted/evicted | Lost progress | Export/import backup, persistent storage request where available, warning |
| Two tabs overwrite save | Data loss | Revision checks and cross-tab coordination |
| First visit offline | No cached app available | Explain one-time initial online load requirement |
| `file://` launch expectation | Modules/SW may fail | Document HTTPS static host as supported run environment |
| Too many dependencies | Large bundle, setup friction | Vue global bundle only, built-in browser APIs, no toolchain |
| SVG/animation complexity | Mobile rendering cost | CSS board, minimal paths, no filters, reduced-motion support |
| Desktop-first visual shortcuts | Poor mobile playability | Phase and acceptance order prioritizes phone screenshots |

---

## 15. Definition of done

The product is releasable when a first-time mobile user can open the static HTTPS site, learn the rules through a verified tutorial, choose Classic or Zen, solve puzzles with touch-only controls, safely undo/redo, receive consistent hints, leave and resume later, review local personal bests, generate or use preverified Zen puzzles, and revisit after the app has been cached while offline. No account, backend, D1, SQL, shared ranking, install step, or Node-based build is required.

**Document authority:** Gameplay rules, data invariants, and acceptance gates in this PRD take precedence over illustrative layouts. [`storyboard.md`](./storyboard.md) owns visual layout, exact screen behavior, and screenshot requirements. Any change that affects core game mechanics must update both documents.


## User-requested design refinement — 2026-10-24

Schedule for **P5 mobile visual polish**: add a restrained Japanese floral branch/twig motif, preferably sakura blossoms, with jasmine as an alternative. Place it in spare space on Home or Zen entry, clear of the board, clues and actions. Use CSS geometry or a tiny optimized SVG (illustration budget under 3 KB); no large image or animation dependency. Check light/dark contrast, 320 px layout and reduced motion. This is decorative and does not affect gameplay. P1 remains focused on core play.

### Implementation note — 2026-10-24, P6

At the user's request, P6 desktop code was implemented after P4. The sakura branch now appears on tablet/desktop Home and Zen entry during this design pass; phone floral polish remains with P5. P5 offline/mobile release implementation, P4 generator acceptance and P6 runtime/visual acceptance remain pending. See `phase-6.md` for the implementation record.
