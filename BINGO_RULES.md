# Playgrove Bingo Duel — Approved Rules & Implementation

**Game:** 2-player real-time Bingo Duel · **Win:** complete at least **5 lines**.

## Board setup — Manual or Random
- Each player creates their own **5×5** board with numbers **1 through 25**, each used **exactly once**. They can build it by **tapping empty cells**, or choose **Random**.
- Boards start empty with no free centre square. The optional **Random** button instantly fills all 25 cells with a Fisher–Yates shuffled arrangement. It is not mandatory.
- **No separate number picker.** Tapping any empty square places the **lowest unused number** (starting at 1). The next empty-square tap places 2, then 3, through 25. Tapping any filled square clears it; the next empty-square tap reuses the smallest missing number. This guarantees unique numbers even when a previous cell is cleared.
- **Random** is available only during editable setup; it asks for confirmation before replacing a partially or fully populated board. Players may clear any automatically arranged cell by tapping it, then tap that cell again to restore its missing number, or tap Random again.
- **Reset Board** clears everything with confirmation.
- Board drafts (manual or randomized) are saved locally on the same device to avoid losing work when navigating away. This is **not** a synchronized server draft.
- **Lock My Board** becomes available only when all 25 numbers are present and unique. The server revalidates everything, stores the board privately, and waits for the other player to lock theirs.

## Gameplay
- The host starts round 1. After a finished round, the host may start a rematch, and the starting player alternates each round.
- Players take turns **calling an unused number** from 1–25. **A single tap** on an unmarked square on the active player's board immediately calls that number; no separate confirmation button is shown. The server validates the call before marking it on both boards.
- Every called number automatically marks that number on **both players' boards**, irrespective of who called it.
- Called numbers cannot be chosen again; the server checks the current turn and requires both players to be connected.
- Valid winning lines: **five horizontal, five vertical, two diagonals**. A line is complete when all five of its squares are marked. A single number may complete multiple lines.
- **Five completed lines** (B-I-N-G-O) wins. The server evaluates **both** players after each call. If both reach five lines simultaneously, the outcome is a **draw**.
- Each player's arrangement is private until the round finishes. Opponents can see the shared called numbers, the other player's line count, and their own 5×5 board.
- In-game state uses separate `bingo:` Socket.IO events and separate room codes, sessions and tokens from Fourcast. They share the same Node.js process but **not** one another's stores or gameplay logic.

## URL and sessions
- Homepage: `/` · Bingo entry: `/games/bingo` · Invitation: `/games/bingo?room=ABC123`.
- The game can resume with `bingo:session` in browser localStorage; leaving for the library temporarily pauses the active game when the socket disconnects. Exiting the room discards the local session.
- Bingo rooms (like Fourcast) are held in server memory, expire after inactivity, and may be lost when Render redeploys/restarts. No account, persistent rankings or global database in this version.
- Fourcast and Sudoku routes and game rules remain unchanged.

## Validation
- Unit tests: 25 unique cells, line counting, privacy, correct turns, rejecting reused/out-of-range calls, offline pause, win/draw, rematch alternation, expiration.
- Browser tests: homepage/routes, sequential tap-to-fill, tap-to-erase and reuse of missing numbers, optional Random generation, overwrite confirmation, board editing, draft restore, two-player join, immediate single-tap number calls and marking on both boards, room resume, winner and rematch, 320/390/768/1440px responsive layout.
- GitHub Actions must pass the TypeScript/unit/build workflow and Chromium smoke tests before merge to main.

## Published code verification

- Implemented, tested and merged in [Playgrove PR #3](https://github.com/HY0831/fourcast-number-duel/pull/3) on 2026-11-09.
- Bingo-specific unit and Chromium browser tests passed, with prior Fourcast and Sudoku regression tests unchanged.
- Deployment is independent of the GitHub merge. Check Render's running commit before treating Bingo as live.

## Optional Random board button (2026-11-09)

- Choosing **Random** fills a valid 1–25 board immediately, with no duplicate numbers.
- It never disables manual entry; players can select a cell and replace or clear its number before locking.
- If any cells are already filled, the app asks before overwriting them. Cancel preserves the current draft.
- Randomized arrangements use the same lock validation, saved draft, gameplay rules and five-line victory conditions as manual boards.
- There are no changes to the Bingo server protocol, Fourcast or Sudoku.

## Tap-to-fill and single-tap calling update (2026-11-09)
- The number-selection keypad below the board and the separate "Clear cell" control are removed.
- Manual setup uses only the 5×5 grid: tap an empty square to place the next missing number, tap a filled square to erase it.
- After a cleared number, the next tap uses the lowest missing number, maintaining all numbers 1–25 exactly once.
- Random and Reset Board remain available; after Random, individual squares can still be cleared and restored.
- During gameplay, an unmarked-number tap sends the call directly to the server and marks both boards on acceptance. The separate call confirmation button is removed.
- The rules, five-line victory, multiplayer room protocol, Fourcast and Sudoku remain unchanged.
