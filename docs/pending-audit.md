# Pending-work audit — 2026-10-24

Follow-up: [the four findings were fixed and rechecked](</Users/farhan/Documents/Farhan/shukaku/docs/audit-fixes.md>). This report retains the original pre-fix evidence.

## Verdict

**Not ready for release.** The independent generated-puzzle uniqueness gate now passes, and the basic P6 layout/keyboard checks pass. Two release blockers remain: offline revisit is unimplemented, and large valid generated histories exceed a shared verification budget and are treated as recovery errors.

This was an audit of the current local code against the user-supplied PRD v1.3 and storyboard, using isolated headless Chrome, pure engine checks and fresh screenshots. The user's screen and existing browser profile were not accessed. No packages were installed. No production code fixes or deployment were performed.

## Findings, ordered by priority

### 1. P1 — Large valid saves are misclassified when verification runs out of budget

**Requirement:** P4 generated-puzzle persistence and P2 portable backup/resume, within the application's advertised import limits.

**Reproduced:**

- A valid 300-puzzle/300-session backup, 1,068,783 bytes, failed its first import with “Generated puzzle could not be verified. Retry with worker support and keep a recovery backup.” No preview appeared and no sessions were imported.
- A valid 1,000-puzzle/1,000-session local history, 2,531,155 bytes, displayed “We couldn’t restore 904 saved item(s)” on the initial Home load. All 1,000 raw sessions remained in IndexedDB. The warning counts both definitions and dependent sessions; it is not evidence that 904 sessions were deleted.
- The pure verification reproduction stopped after 197 definitions with `PARTIAL / WORK_BUDGET`, with zero actual rejected definitions.

**Cause:** [registerDefinitions](/Users/farhan/Documents/Farhan/shukaku/js/state/use-game.js:76) sends every unknown definition in one worker request. The six-million-operation budget applies across the entire batch. Unfinished definitions are then classified as invalid, and strict import rejects the whole preview. The same path is used by [refresh](/Users/farhan/Documents/Farhan/shukaku/js/state/use-game.js:92) and [selectImport](/Users/farhan/Documents/Farhan/shukaku/js/state/use-game.js:272). Individual definitions are valid; the workload has exceeded a batch budget.

**Fix:** Verify bounded chunks asynchronously with progress and cancellation. Distinguish “not verified yet” from “invalid.” Keep current raw records and proof requirements, and complete supported valid imports without making the user retry the same file. Recheck first-load restoration, newest-session Continue, and both merge and replacement at the supported size limits.

**Evidence:** [bulk results](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/bulk-browser-results.json), [verification budget](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/bulk-verification-results.json).

![A valid backup is rejected](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/390-bulk-import-rejected.png)

![Valid local records produce a recovery warning](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/390-bulk-restore-recovery.png)

### 2. P1 — Offline revisit fails because P5 has not been implemented

**Requirement:** `OFF-01` and PRD section 9.3: cached app shell and puzzles must open on a repeat visit without network access.

After an online preload, switching the isolated browser context offline and reloading failed with `net::ERR_INTERNET_DISCONNECTED`. The origin had zero service-worker registrations. There is no service-worker implementation or registration in the application. An optional PWA manifest is not the missing mandatory requirement; offline caching is.

**Fix:** Implement versioned critical-asset precaching and an offline navigation response, including Vue, native modules, worker dependencies, bundled puzzle data and styles. Keep the previous working cache until replacement installation succeeds. Recheck cold and repeat visits, updates, missing assets and generated-session restoration on the intended HTTPS host.

**Evidence:** [browser results](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/browser-results.json), [application entry](/Users/farhan/Documents/Farhan/shukaku/index.html:16).

![Offline reload reaches Chrome's disconnected page](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/offline-reload-failure.png)

### 3. P2 — Some advertised Zen choices frequently fall back

All accepted puzzles were uniquely solvable and matched their measured rating range. Availability is the issue: the bounded generator frequently fails to find a matching candidate and opens a ready-made 5×5 instead.

| Size | Gentle: requests without generated result | Balanced | Challenging |
| --- | ---: | ---: | ---: |
| 5×5 | 0 / 100 | 78 / 178 | **1,200 / 1,300 (92.3%)** |
| 6×6 | 0 / 100 | 2 / 102 | 84 / 184 |
| 7×7 | 0 / 100 | 1 / 101 | 102 / 202 |
| 10×10 | 16 / 116 | 0 / 100 | 34 / 134 |
| 12×12 | **208 / 308 (67.5%)** | 1 / 101 | 25 / 125 |

These are deterministic audit-seed samples, with previously accepted board fingerprints excluded and the normal 48-attempt limit. They are not universal production probabilities or phone benchmarks. Every failure in this batch was `ATTEMPT_BUDGET`, rather than a time/work limit. The 5×5 Challenging sample was extended beyond the initial 400-request sampling cap to reach the required 100 distinct acceptances.

**Fix:** Improve the partition/clue proposal strategy and calibrate the logical ranges, particularly 5×5 Challenging and 12×12 Gentle. Do not weaken uniqueness proof or silently relabel a puzzle. Consider size-matched verified fallback content once independently checked.

**Source:** [candidate proposal and retry pipeline](/Users/farhan/Documents/Farhan/shukaku/js/engine/generator.js:10), [fallback selection](/Users/farhan/Documents/Farhan/shukaku/js/state/use-game.js:111).

The current fallback is honest: unsupported workers and exhausted generation budgets use known curated content; repeated content and a size mismatch are disclosed. The following screenshot is the fourth fallback request after selecting 12×12.

![Honest repeated fallback and size disclosure](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/390-fallback-repeat.png)

### 4. P2 — Several controls miss the project's 44×44 target

Across the captured viewport sizes, settings switches measured **46×28 px** and Fit measured approximately **41×44 px**. The switch label is a sibling span, so the row text does not enlarge the button's click target.

**Fix:** Keep the small visual switch track inside a button/hit area at least 44 px high, or provide a properly associated clickable label that enlarges the effective target. Give Fit a minimum width of 44 px. Recheck pointer/touch activation and focus rings at 320 px and in both themes.

This is a mismatch with the PRD's project target, not a claim that a complete WCAG audit was performed.

**Source:** [switch dimensions](/Users/farhan/Documents/Farhan/shukaku/css/mobile.css:86), [text-button sizing](/Users/farhan/Documents/Farhan/shukaku/css/base.css:23).

![Small switch targets in phone settings](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/320-settings.png)

## Audited flow and health

1. **Enter Classic or Zen — basic pass.** Home, Classic selection, Zen entry, Settings and Classic board were captured at 320×568, 360×800, 390×844, 430×932, 768×1024 and 1440×900. None had horizontal page overflow. Wider layouts placed tools beside the board. Short screens retain natural vertical scrolling; every control is not required to fit above the fold.
2. **Generate a Zen puzzle — correctness pass; availability needs work.** 100 distinct accepted puzzles for each of 15 advertised size/difficulty pairings: 1,500 total. Every accepted puzzle passed structural/completion checks and the separate `countSolutions` implementation returned exactly one solution. Every tenth acceptance was replayed and restored, with no mismatches. One example per pairing was also reproduced through the actual module worker.
3. **Play, zoom and use the keyboard — basic pass.** Row/board Home/End, two-corner selection, undo/redo, zoom/fit and pause worked. Modal Tab trapping included keyboard disclosures. A 12×12 board at 320 px reached 300% zoom, panned horizontally and retained its selection anchor, including after Fit. Desktop dark mode and reduced-motion behavior passed the exercised checks.
4. **Get hints and save progress — small-history pass; bulk failure.** The existing 72-check harness passed, including the independent 462 small-board comparisons. Fresh hint regression checks passed for Nudge/Explain, undoable Reveal, assisted completion records, contradiction guidance and unavailable/cancelled responses. A generated move survived reload. A small generated backup imported into a new context; altered clues were rejected. Large supported histories failed as described above.
5. **Cancel or recover from generation failure — pass in exercised cases.** Work/time limits and an outer deadline returned unavailable results. Delayed cancelled and navigated-away responses created no sessions. Four worker-unavailable requests used all three fallback definitions before labeling a repeat, and disclosed the requested 12×12 versus actual 5×5 size. There were no unexpected page errors or remote runtime requests in the main suite.
6. **Revisit offline and release — fail/pending.** Offline reload failed. P5 implementation, phone floral polish, full mobile error-state acceptance and physical-device/browser coverage remain open. The current sakura SVG is visible only at 768 px and above; that is a documented P6 treatment, not completion of P5 phone polish.

### Representative wider-screen evidence

The inspected desktop board has a clear primary play area and one shared tool panel, and the pause dialog centers without replacing the mobile bottom-sheet pattern. At 1440×900 the message below the large board can require a short vertical scroll; the board is not horizontally clipped.

![Desktop board and tool panel](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/1440-board.png)

![Desktop pause dialog and keyboard help](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/1440-paused-keyboard.png)

The 1,375-byte sakura branch sits outside the Home and Zen text/actions in the inspected wider views and has no animation.

![Sakura branch on desktop Home](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/1440-home.png)

## Requirement coverage

| Requirement | Assessment | Evidence / remaining work |
| --- | --- | --- |
| GEN-01, accepted puzzles unique | **Covered by audit sample** | 1,500 distinct accepted; independent count 1 each; no violations |
| P4 100 distinct per supported tier | **Numeric uniqueness gate passed** | 100 per size/difficulty pairing, including all 15 choices |
| GEN-02 seed/version replay | **Covered in exercised cases** | Every tenth accepted puzzle plus 15 actual-worker examples |
| Worker bounds and cancellation | **Covered in exercised cases** | Work/time limits, deadline, delayed cancellation/navigation |
| Honest curated fallback and repeats | **Covered** | All three definitions used before repeat; size mismatch disclosed |
| Logical difficulty and enjoyment | **Partial** | Metric ranges enforced; poor availability in several choices; human calibration pending |
| Generated save and portable backup | **Partial / blocker** | Small history passes, large valid imports/restores fail budget handling |
| P6 tablet/desktop adaptation | **Partial** | Representative layouts and shortcuts pass; full visual/error-state matrix and browser coverage not complete |
| P5 hit targets/accessibility polish | **Partial** | Keyboard checks pass; undersized controls remain; no full assistive-technology audit |
| P5 small assets | **Partial** | Local application resources total 321,533 raw bytes; sum of individually gzip-compressed files is 108,817 bytes; hosting transfer/performance not measured |
| OFF-01 offline repeat visit | **Missing / failed** | No registration or caching implementation; offline reload fails |
| P5 phone sakura treatment | **Pending** | Decoration deliberately hidden below 768 px |
| HTTPS release smoke test | **Pending** | No site deployed during this audit |

## Reproduction and evidence

All artifacts are in [the audit folder](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit).

- [Generator results and seed IDs](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/generator-results.json)
- [Main browser results](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/browser-results.json): 20 grouped checks passed; offline reload failed.
- [Bulk-history browser results](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/bulk-browser-results.json): 2 failed expected-success checks.
- [Fresh hint regression results](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/phase-3-regression/results.json)
- [Asset-size measurements](/Users/farhan/Documents/Farhan/shukaku/docs/qa/pending-audit/asset-sizes.json)
- Saved scripts: `run-generator.mjs`, `run-browser.cjs`, `run-bulk-generator.mjs`, `run-bulk-1000-generator.mjs`, `run-bulk-browser.cjs`, and `run-regression.cjs` in that folder. Browser scripts use the already available local Playwright Core and Chrome paths; they add no application dependency or release build step.

Limits: headless desktop Chrome with viewport/touch emulation is not physical Android/iOS testing. No claim of 60 FPS, phone preview latency, full screen-reader support, full contrast compliance or complete regression coverage is made. Screenshot capture covered the named matrix; visual inspection focused on the representative images used in this report and selected phone/tablet/dark/zoom states. The remaining stored captures are diagnostic artifacts, not independently approved design frames.

## Recommended order

1. Correct chunked verification and re-run large valid import/restore tests.
2. Implement P5 offline caching and pass OFF-01, update and missing-asset checks.
3. Improve generation availability while keeping uniqueness proof intact.
4. Enlarge control hit areas and finish phone visual polish, then run the remaining phone-first acceptance matrix and HTTPS release checks.
