# Playgrove Game #9 — Reversi

**Purpose:** A classic two-player strategy game for the user and their girlfriend, hosted entirely on the existing free Playgrove Node/WebSocket service. No database, account, external API, in-app currency or paid resources.

## Official-style Reversi rules
- An 8×8 board begins with four discs in the central 2×2 positions: White at d5/e4 and Black at e5/d4 when viewed from the standard top-to-bottom row order. The two colours occupy opposite diagonal pairs.
- **Black plays first.** Players alternate placing one disc of their colour in an empty square.
- Every legal placement must enclose at least one contiguous line of opponent discs between the placed disc and an existing friendly disc. All enclosed discs flip; horizontal, vertical and diagonal lines count. Flips occur in **all eight directions**.
- The server rejects occupied, non-flipping, out-of-range, wrong-turn and disconnected moves.
- **Forced pass:** if the next player has no legal placement, their turn automatically passes to their opponent. Players with legal moves cannot pass.
- **End condition:** the round ends when neither player can place a legal disc, even if empty squares remain. A full board also ends the round.
- **Winner:** more discs on the board. An equal final count is a draw.
- Rematches require approval by **both players**. The Black and White seats swap each new round, and Black always plays first.

## Online play and reconnection
- Each private room has a six-character code; the invited player can join via /games/reversi?room=ABC123 or by entering the code.
- Joining starts the game automatically. No account is needed.
- Opaque random player tokens authorize moves and reconnect a device; tokens are **never** included in broadcast room snapshots.
- A player cannot move for another player; the server verifies room phase, online state, session ownership, turn and move legality.
- Disconnect pauses the match. Reconnecting on the same browser using the original token restores the board and turn while the server process stays running.
- Resuming a different seat on the same socket releases the old seat; switching to another game releases Reversi presence too.
- Rooms expire after three hours without activity. Render Free sleep, restart or deployment loses active rooms; both players can create a fresh game.

## User experience
- Home page card searchable as Reversi/Othello; classified as Multiplayer. Route /games/reversi lazily loads the game.
- Responsive mobile-first dark-brown/cream/lime Playgrove styling with a green 8×8 board, clear Black/White discs and four initial legal opening squares.
- Only legal moves are interactive. An available move has a small lime hint marker; the newest placement is highlighted.
- A status banner identifies your turn, your opponent's turn, forced passes, offline pause and final result.
- Live Black and White disc counts, remaining empty squares and last-move flip tally.
- Private lobby with copyable invitation and native share-sheet fallback; saved session resume from Game Library.
- Win/draw screen with both players' consent before rematch. Uses semantic board/grid controls, distinct text and disc colour, keyboard focus outlines and reduced-motion rules.

## Technical implementation
- server/reversi-engine.mjs: pure Reversi rules, server-owned room states, seat assignment and public snapshots.
- server/index.mjs: Reversi Socket.IO namespace events: reversi:create, reversi:join, reversi:resume, reversi:place, reversi:rematch, reversi:leave; broadcasts reversi:update.
- client/src/games/reversi/ReversiPage.tsx + reversi.css: lazily loaded gameplay and responsive UI.
- tests/reversi-engine.test.mjs: opening moves, eight-direction capture, no edge wrapping, invalid moves, passes, 32–32 draws, rematch and tokens.
- tests/multiplayer-reconnect.test.mjs: real two-browser sockets, peer disconnects, session/token recovery, same-socket seat takeover and cross-game isolation.
- e2e/reversi.spec.ts: private invite flow, real browser flips, 64 cells, responsive widths, reconnect/navigation, entire game and rematch, localStorage denial.
- README.md, PROJECT_PLAN.md: architecture and release backlog.

## Release gates
- [x] Approved for development by owner as ninth mind-challenging Playgrove game.
- [x] Feature branch contains server rules, new client and tests; no dependencies or databases.
- [ ] TypeScript, Node and production Vite build verified.
- [ ] All browser tests across nine games verified, including full online Reversi rematch.
- [ ] Squash-merge feature PR only when both pipelines are green.
- [ ] Deploy exact reviewed commit to existing Render Free Singapore service, verify /health and production logs.
- [ ] Real Android/iOS two-device input and VoiceOver/TalkBack checks remain manual (not covered by Chromium CI).
