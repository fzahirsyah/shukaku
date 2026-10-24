# Phase 6 — Desktop last

Implementation date: 2026-10-24. Scope: PRD P6 and storyboard sections 4.3 / 14. The user explicitly requested P6 after P4. P6 is the final numbered phase in the plan, but P5 offline/mobile release implementation and prior acceptance gates remain unfinished.

## Delivered code

- `css/desktop.css` layers adaptations over the phone stylesheet. At 768 px the game uses a board column plus a 216 px tool panel; at 1024 px the panel becomes 264 px with more breathing room. The game shell caps at 1120 px.
- A single board and single set of tool buttons serve every viewport. On phones, the new wrappers remain normal blocks in the original order. There are no duplicated game states or desktop-only gameplay requirements.
- The board column is bounded by available width and viewport height, up to 640 px. Zoom remains inside a bounded scrolling viewport. Short windows retain outer-page scrolling and explicit zoom/pan controls.
- Tablet/desktop Home presents the mode cards side by side. Settings uses two columns; Classic, Zen and tutorial pages retain readable maximum widths. Focused controls retain existing focus styling.
- Bottom sheets become centered, scrollable dialogs above the tablet breakpoint, while phones keep their bottom sheets. The existing modal backdrop and inert background remain in use.
- A focus-visible Skip to main content link moves focus to the current page heading without creating a router navigation.

## Keyboard polish

Shortcuts are handled on the board, rather than by a global document listener:

| Keys | Action |
| --- | --- |
| Arrows | Move cell focus; extend an existing corner preview |
| Home / End | First / last cell in the current row |
| Ctrl or Command + Home / End | First / last board cell |
| Enter / Space | Choose a corner |
| Escape | Cancel selection |
| Delete / Backspace | Remove the rectangle at the focused cell |
| Ctrl or Command + Z | Undo |
| Ctrl or Command + Shift + Z; Ctrl + Y | Redo |
| + / − | Zoom |
| 0 | Fit view |
| P | Open game options / pause Classic |

Undo/redo shortcuts also work in the tutorial. Zoom, fit and pause apply to the game screen. All operations reuse existing commands, save behavior, bounds and pause handling. No destructive restart shortcut was introduced.

Composition input and Alt combinations are ignored; other Control/Command combinations remain available to the browser. Actions are rejected during loading, busy operations, modal sheets, hidden pages, conflicts and locked/completed sessions. Keyboard focus is scrolled into view; pointer selection retains its existing no-scroll focus behavior.

Keyboard controls are documented in an expandable panel beside the board on wider screens and in Game Options on all sizes. Modal Tab trapping now includes visible disclosure summaries, selects and textareas.

## Sakura branch

`assets/sakura-branch.svg` is a local 1,375-byte decorative illustration of a twig with sakura blossoms. It is visible in spare space on wider Home and Zen entry screens, with a dark-theme brightness adjustment. It has empty alternative text, is hidden from accessibility APIs and does not intercept input. It has no animation or network dependency. It is not an SVG game board.

The earlier floral request was scheduled for P5; its tablet/desktop treatment was implemented during this P6 design pass. Phone decoration remains deferred with P5 mobile polish.

## Checks and remaining acceptance

JavaScript module syntax checks and `git diff --check` passed. No automated tests, browser runtime QA, screenshots or screen access were used for this implementation step. No measured layout, interaction or visual pass is claimed.

The P6 acceptance gate remains open: phone regression at 320×568, 360×800, 390×844 and 430×932, followed by 768×1024 and 1440×900 representative screens, in light/dark themes and reduced motion. Include large-board zoom/pan, keyboard navigation and shortcuts, modal focus, scrolled/short windows, hints, completion and save recovery. If browser QA is requested, use an isolated headless browser in keeping with the user's screen restriction.

P4’s 100 distinct accepted puzzles per supported tier still needs independent uniqueness verification. P5 still needs offline/service-worker support, the mobile asset/accessibility pass and release QA. Deployment remains separate. The final numbered phase being implemented does not make these earlier requirements complete.
