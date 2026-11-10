# Playgrove Minesweeper — Fourth Game Implementation

**Approval:** Single-player Minesweeper with Easy, Medium and Hard levels, phone-friendly flag/reveal mode, first-click safety, flagging, pause, timer, and saved progress.

## Rules and difficulty settings

| Level | Width × height | Mines | Safe cells |
|---|---|---:|---:|
| Easy | 9 × 9 | 10 | 71 |
| Medium | 16 × 16 | 40 | 216 |
| Hard | 30 × 16 | 99 | 381 |

- First tap generates the field after selecting a mine-free opening cell and all neighbors, then performs a zero flood reveal.
- Left click / Reveal-mode tap uncovers a square. Right-click / Flag-mode tap toggles a flag. F on a focused square toggles a flag and arrow keys navigate the grid.
- Revealing a numbered square shows how many of the surrounding eight squares contain mines; zeroes expand automatically.
- Flags prevent accidental revealing; they are optional. Win by revealing every non-mine square, even if no flags have been placed. Reveal a mine to lose.
- Pause freezes the timer and disables board input. The timer counts only while the game is active and visible.
- A game is saved locally per difficulty in browser localStorage (including first-click-generated board, flags, reveals, seconds). Best times are also stored locally. No accounts required.
- Large boards support horizontal and vertical scrolling, with Compact / Regular / Large zoom and a mobile Reveal/Flag control.
- Random boards are traditional, not guaranteed to be solvable without guessing.

## Architecture

- `client/src/games/minesweeper/minesweeper-engine.mjs` pure engine with typed declaration.
- `client/src/games/minesweeper/MinesweeperPage.tsx` React UI and persisted sessions.
- `client/src/games/minesweeper/minesweeper.css` styles scoped to `.msw-shell`.
- `tests/minesweeper-engine.test.mjs` engine unit tests.
- `e2e/minesweeper.spec.ts` browser navigation, difficulty, mobile, flagging, pause/save, loss/win, and reset tests.
- Existing multiplayer server, Fourcast, Bingo and Sudoku gameplay code untouched.

## Release checks

- [ ] All Node unit tests and TypeScript/Vite production build pass on GitHub Actions.
- [ ] Playwright Chromium tests including existing Fourcast, Sudoku and Bingo regressions pass.
- [ ] Pull request merged only after successful checks.
- [ ] Verify Render's running commit after merging; deploy manually if Auto-Deploy does not trigger.
