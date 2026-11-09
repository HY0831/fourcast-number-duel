# Playgrove — Minesweeper (proposed fourth game)

**Status: Design proposal only. No Minesweeper code has been implemented or merged.**
**First release: single-player; no server or room changes.**

## Goal
Add a classic Minesweeper puzzle game to Playgrove alongside Fourcast, Sudoku and Bingo Duel. Use the Playgrove earthy palette with clear, high-contrast cell labels and a mobile-first layout.

## Proposed rules
1. Choose Easy, Medium or Hard.
2. Reveal all cells that do **not** contain a mine. A revealed digit 1–8 counts mines in the up to eight surrounding cells, diagonals included.
3. Revealing a zero automatically expands through neighboring safe zeros and their number borders.
4. The first reveal never hits a mine. Prefer reserving its eight neighbors too so the first move opens a useful area.
5. Reveal a mine and the attempt ends. Show the triggered mine, reveal other mine positions and offer a New Game action.
6. Flag or unflag cells believed to contain mines. Flags prevent accidental reveals. Flagging all mines is **not** the victory condition; revealing every safe cell wins. Player can win with unflagged mines.
7. No hints/undo in v1, and no "guaranteed no-guess" claim. Traditional random boards can occasionally require guessing.

## Difficulty proposal: classic sizes
| Level | Board | Mines | Safe cells |
| --- | --- | ---: | ---: |
| Easy | 9 × 9 | 10 | 71 |
| Medium | 16 × 16 | 40 | 216 |
| Hard | 30 × 16 | 99 | 381 |

These are the common classic Minesweeper board dimensions. Because a 30-column board cannot fit legibly on a phone, use a **scrollable/pannable board viewport**, not tiny cells. Target square size around 34–40 CSS pixels, and optional zoom controls ("Fit" / "Comfortable") for tablet/desktop. Keep HUD visible while browsing a large grid.

## Controls
- Desktop: left click reveals; right click flags/unflags; optional arrow-key navigation, Enter reveal, F flag.
- Mobile: tap reveals in Reveal mode; tap flags in Flag mode. Offer an explicit Reveal/Flag segmented toggle above the board. Optional long-press-to-flag with a clear label and safeguards against the same touch also opening the cell.
- Counter: remaining mines estimate = mine total − flags placed, not a correctness score.
- Timer starts with the first reveal; a clearly labelled Pause control pauses time and blocks board interaction; New Game restarts with confirmation if unfinished.

## Proposed layout
- Shared Playgrove header with All games.
- Game title "Minesweeper" and three difficulty cards (Easy / Medium / Hard).
- Compact HUD row: Mines left (counter), elapsed time, New Game and Pause.
- On mobile, prominent Reveal/Flag mode toggle, with large touch controls and no unsafe long-press-only dependency.
- Board panel with distinct covered, revealed, zero, flagged, exploded mine, and incorrect flag states.
- Result panel: victory or loss, level, elapsed time, and replay.
- Local progress autosave and best time per level in browser localStorage, as with Sudoku.

## Technical architecture (after approval)
- Route `/games/minesweeper` and a fourth game-library card.
- `client/src/games/minesweeper/MinesweeperPage.tsx` for UI and input handling.
- `client/src/games/minesweeper/minesweeper-engine.mjs` for seedable generation, neighbors, first-reveal safety, flood reveal, flags, win/loss, and reset.
- `client/src/games/minesweeper/minesweeper.css` scoped styles.
- No new server endpoints, database, user accounts, lobby, or Socket.IO events in v1.
- Unit tests: mine count, safe-first-click, neighbor counts, zero cascades, illegal reveals, flagging, win/loss, persistence.
- Playwright browser tests: each level, desktop right-click and mobile mode toggle, win/loss, pause, local save, 320/390px responsiveness, existing game regressions.
- Build and test on a feature branch; merge only when checks pass; Render deploy separately.

## Decisions requiring approval
- **Recommended:** use classic board sizes above rather than custom smaller boards.
- Keep Minesweeper **single-player in v1**. Multiplayer racing modes would be a separate later feature.
- Preserve Fourcast, Sudoku and Bingo Duel unchanged.
