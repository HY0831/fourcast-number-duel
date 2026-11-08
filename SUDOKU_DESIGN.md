# Playgrove Sudoku — Product and Implementation Notes

## Scope

Add **Sudoku** as the second playable game in Playgrove, next to the existing Fourcast multiplayer number duel. Sudoku is a **single-player**, client-side puzzle game for v1, playable on mobile and desktop; it does not create multiplayer rooms or modify the existing Fourcast Node/Socket.IO server.

## Difficulty

| Level | Starting clues | Required solving technique for verified seed puzzles |
|---|---:|---|
| Easy | 43 | Naked singles suffice |
| Medium | 34 | Singles with hidden singles required |
| Hard | 29 | Basic naked/hidden singles alone are insufficient |

Three verified uniquely solvable seeds per level are provided (9 in total). Digit shuffling, row/column permutations, band/stack permutations and optional transposition generate varied games without changing the logical grade or number of givens. Each generated puzzle has exactly one solution, verified independently by the tests.

## Gameplay

- Full 9×9 Sudoku board with 3×3 box boundaries. Given numbers are immutable.
- Tap/keyboard number entry 1–9, erase (0/delete), pencil notes, undo, select cells with arrow keys.
- Timer automatically pauses when the game is hidden or manually paused. No mistake limit; wrong entries and duplicate conflicts are highlighted.
- Hint fills the selected empty or incorrect cell, or the next unresolved cell, with the solution digit. Hints are counted.
- Each level has its own saved progress on the current device and a local best-time record. Switching levels restores that level's last puzzle.
- The solution screen reports level, elapsed time and mistakes, and offers a new puzzle.
- Returning to Playgrove retains the Sudoku session; Fourcast's existing room-recovery behavior and invite links are untouched.

## Architecture

- "/" — Playgrove library, now 2 available games.
- "/games/fourcast" — existing Fourcast, no rule or network changes.
- "/games/sudoku" — new single-player Sudoku page.
- `client/src/games/sudoku/sudoku-engine.mjs` is pure and dependency-free; `SudokuPage.tsx` handles the responsive board, local state and input.
- Sudoku uses `localStorage` for the current game's progress and best time, without accounts or a database. Browser-data clearing resets saved games.

## Release checks

- [x] Independent tests: 9 seed grids, distinct difficulty grades, unique solutions, transformations, immutable givens, hints, conflicts, editing, solved state.
- [ ] GitHub Action: TypeScript check, unit tests, production build.
- [ ] Playwright: Playgrove 2-game library, Sudoku routes, difficulty controls, mobile layouts, pencil marks, input, undo, hint, pause, save/resume, win.
- [ ] Playwright: Fourcast end-to-end regression.
- [ ] Merge feature branch only after all checks pass.