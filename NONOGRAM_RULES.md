# Playgrove Nonogram — Picture Logic (Game 7)

## Shipped scope

- 30 **curated, fixed pixel-art pictures**, not random number grids; **10 each** of Easy (5×5), Medium (10×10), Hard (15×15).
- Pictures are authored and saved as binary matrices in `client/src/games/nonogram/puzzle-library.mjs`. Exact artwork is hidden in the gallery until the picture is solved.
- Categories: Animals, People, Food, Nature, Objects, Places, Symbols. Category, difficulty and title search filters.
- Each puzzle has automatically generated and independently verified row/column clues, a unique solution and can be solved by iterative line deduction without guessing.
- Players mark cells **Fill** or **X**, toggle a marked cell clear, use Undo, and may request up to three hints per attempt. Incorrect fills are not immediately announced to preserve the logic challenge.
- Hint action corrects an incorrectly filled square first, otherwise fills a required unfilled square. Undo reverses hints as well as marks. The maximum of three hints is enforced by the engine.
- Solved if and only if all 1-solution squares are filled and no 0-solution square is filled. X marks on blank cells are optional. Puzzle can be replayed.
- Elapsed timer begins on first move, ignores background browser tab, and can be paused; no countdown or penalty for taking time.
- Local browser storage keeps each puzzle's marks, elapsed time, hints, undo history, completion status and personal best. Neither accounts nor backend/API/socket changes are required.
- Easy boards fit on most mobile phones. 10×10 and 15×15 use a scrollable/zoomable grid, keeping row/column clues sticky as the grid scrolls.
- Desktop: left click in selected Fill/X mode; right click always X; F=Fill, X=mark blank, Arrow keys=move focus. Mobile: explicit Fill/X mode toggle and touch squares.

## Initial picture library

| ID | Easy 5×5 | ID | Medium 10×10 | ID | Hard 15×15 |
|---|---|---|---|---|---|
| E01 | Heart | M01 | Cat Face | H01 | Sitting Cat |
| E02 | Star | M02 | Puppy Face | H02 | Standing Dog |
| E03 | Arrow | M03 | Rabbit | H03 | Portrait |
| E04 | Sun | M04 | Owl | H04 | Dancer |
| E05 | Mushroom | M05 | Butterfly | H05 | Bicycle |
| E06 | Crescent Moon | M06 | Ice Cream Cone | H06 | Vintage Car |
| E07 | Little House | M07 | Birthday Cake | H07 | Lighthouse |
| E08 | Pine Tree | M08 | Rocket | H08 | Castle |
| E09 | Coffee Mug | M09 | Sailboat | H09 | Elephant |
| E10 | Diamond | M10 | Cactus | H10 | City Skyline |

## Data validation and testing

- `tests/nonogram-engine.test.mjs` recalculates clues for all 30 pictures, solves each from clues and asserts exactly **one** solution, with no guessing required.
- Playwright `e2e/nonogram.spec.ts`: gallery, filters, artwork spoilers, clue labels, Fill/X/Undo, right-click, keyboard, hints, pause, save/reload, reset, win and thumbnail reveal, large mobile boards, corrupted save recovery.
- Regression tests for Fourcast, Sudoku, Bingo, Minesweeper, Connect Four and 2048 must pass before merging.

## Expansion

New pictures can be added to `puzzle-library.mjs` after validation of their dimensions, row/column clues, solution uniqueness and visual recognizability. Do not publish unreviewed or random image sets. A future account-backed cloud gallery could be added separately; v1 uses only local browser storage.
