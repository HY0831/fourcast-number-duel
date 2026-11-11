# Playgrove — 2048 (Game #6)

## Game rules

Single-player 2048 on a 4×4 grid. The player slides all tiles simultaneously with arrow keys, mobile swipes, or on-screen arrow buttons. Identical adjacent tiles merge into one of double value, and each merged tile adds its new value to the score. A tile can merge **only once** per move. Every successful move spawns one new tile in a uniformly random empty cell: 2 with 90% probability and 4 with 10% probability. Moves that do not change any tile do not spawn new tiles.

The board begins with two random tiles. Reaching 2048 shows a win screen with **Keep playing** and **New game**; the player can then continue toward larger numbers. The game ends when all 16 cells are filled and there is no legal horizontal or vertical merge.

## UI and quality

- Responsive board with 16 readable, high-contrast tiles, keyboard and mobile swipe controls, and four optional direction buttons. Accessible labels describe every tile.
- Current score, best score, biggest tile, moves, and empty-space count.
- **Undo last move** returns the board, score, and moves to the last successful move's pre-state, including removing the randomly spawned tile. Only one undo is available; a future move establishes a new undo point. Best lifetime score is never reduced by undo.
- **New game** clears active progress after confirmation and keeps the best score.
- Local browser save at `playgrove:2048:v1`, with defensive validation when reloading corrupt saved data. Best score at `playgrove:2048:best`.
- No account, database, Socket.IO or server changes required. Existing Fourcast, Sudoku, Bingo, Minesweeper and Connect Four behaviour remains intact.

## Release checklist

- Feature branch `feature/playgrove-2048-v1-20261111`.
- Unit tests for rules, moves, merges, scores, random spawning, wins, game-over and saved progress.
- Playwright browser tests for all six games, keyboard / swipes, score / undo, browser persistence, win and loss overlays, and mobile overflow.
- Merge to `main` only when TypeScript, unit, build, and browser checks pass.
- Render deployment is separate from GitHub merge; deploying may disrupt active multiplayer rooms maintained in memory.
