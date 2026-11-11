# Playgrove V4 — Accessibility & Mobile Gameplay Polish

Date: 2026-11-11
Branch: `polish/playgrove-v4-accessibility-20261111`

## Scope and principles

Quality pass for **all seven released games**: Fourcast, Sudoku, Bingo Duel, Minesweeper, Connect Four, 2048, and Nonogram. Preserve approved gameplay, room rules, UI palette, saves, APIs, and socket event names. Accessibility is progressive; this is **not a claim of complete WCAG or screen-reader certification**.

## Findings and changes

| Game | Confirmed issue | Improvement |
| --- | --- | --- |
| Sudoku | Global number/arrow shortcuts could hijack keyboard input while other buttons were focused, and grid selection did not move DOM focus with arrow navigation | Limit shortcuts when unrelated controls are focused, move actual focus with selected cell, describe pencil notes to assistive technology, expose keyboard help and announce completion |
| 2048 | Global arrows could intercept focus while using navigation/actions; board moves lacked short audible progress updates | Exclude buttons/form controls from global movement shortcuts, expose board instructions and a concise live move/score announcement, announce win/loss |
| Minesweeper | Cell labels were present but keyboard instructions were not explicitly associated with the grid, and safe-cell/flag changes were not summarized | Attach grid keyboard instructions and a live summary of revealed safe squares and flag count without announcing ticking time |
| Nonogram | Row/column clues were visually shown but not exposed with the currently focused cell | Include both clue axes within each cell's accessible name; associate keyboard instructions, announce progress and empty gallery state, provide visible search focus ring |
| Fourcast | Game mode buttons displayed selected state without semantic pressed state; turn banner did not explicitly announce changes | Add `aria-pressed` and live turn/win feedback |
| Bingo Duel | Create/join actions had only visual selection and board status lacked live feedback | Use accessible grouped pressed buttons and a polite live turn/status message |
| Connect Four | Create/join controls used an incomplete tab semantics pattern; columns did not expose disc occupancy and turn status had no explicit live behavior | Use grouped pressed buttons, provide bottom-to-top disc description for each column, add live turn/status announcements |

Mobile adjustments: Sudoku's smallest-width number keypad has a minimum 44px height, Bingo's outline actions are at least 44px high, and Nonogram's search input now has a visible focus-within ring. Responsive layouts and original colour palette remain unchanged.

## Tests

Added `e2e/accessibility.spec.ts`:
- Sudoku keyboard arrows move real focus, while arrows on an unrelated button do not move the grid; 320px digit target size.
- 2048 arrows do not hijack the focused New Game button, while board keys still move and announce scores.
- Minesweeper keyboard help and progress, Nonogram search focus, row+column clues and focus navigation.
- Fourcast/Bingo/Connect Four pressed-state semantics.
- Connect Four two-player column occupancy descriptions and live status.

Run alongside the **entire existing 95-test Node suite** and Chromium game regression suite. These checks are *automated coverage*, not a replacement for real mobile/touch-device and screen-reader manual verification.

## Safety and remaining work

- No changes to game algorithms, socket protocols, save formats, room expiry, or deployment.
- Physical device touch performance, VoiceOver/TalkBack/NVDA walkthroughs, contrast checks in every individual game state, and some large Nonogram mobile cell sizing require separate manual accessibility audits.
- Render deployment remains a separate release gate; restarting the Node process can destroy current in-memory multiplayer rooms.

## Merge gates

- [ ] TypeScript, Node tests and production Vite build pass.
- [ ] Full Chromium Playwright regression including 5 new accessibility tests passes.
- [ ] Merge only after both workflows pass.
