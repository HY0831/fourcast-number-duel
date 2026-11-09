# Playgrove Bingo Duel — Approved Rules & Implementation

**Game:** 2-player real-time Bingo Duel · **Win:** complete at least **5 lines**.

## Manual board setup
- Each player creates a fully manual **5×5** board with numbers **1 through 25**, each used **exactly once**.
- **No automatic arrangement**, no prefilled numbers, no free central space.
- Tap any board square, then select a number from the 1–25 number picker. Used numbers are disabled until erased or replaced. The cursor advances to the next empty square for convenience; the user can still tap any cell and edit it.
- Clear Cell deletes the selected entry; Reset Board clears everything with confirmation.
- Board drafts are saved locally on the same device to avoid losing work when navigating away. This is **not** a synchronized server draft.
- **Lock My Board** becomes available only when all 25 numbers are present and unique. The server revalidates everything, stores the board privately, and waits for the other player to lock theirs.

## Gameplay
- The host starts round 1. After a finished round, the host may start a rematch, and the starting player alternates each round.
- Players take turns **calling an unused number** from 1–25. Tap an unmarked square on your own board, then tap **Call number N** to confirm.
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
- Browser tests: homepage/routes, manual entry, number uniqueness/erase, two-player join, call and marking on both boards, room resume, winner and rematch, 320/390/768/1440px responsive layout.
- GitHub Actions must pass the TypeScript/unit/build workflow and Chromium smoke tests before merge to main.

## Published code verification

- Implemented, tested and merged in [Playgrove PR #3](https://github.com/HY0831/fourcast-number-duel/pull/3) on 2026-11-09.
- Bingo-specific unit and Chromium browser tests passed, with prior Fourcast and Sudoku regression tests unchanged.
- Deployment is independent of the GitHub merge. Check Render's running commit before treating Bingo as live.
