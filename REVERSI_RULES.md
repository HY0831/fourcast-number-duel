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
- [x] TypeScript, Vite build and all 116 Node tests passed (run 43061255200).
- [x] All 60 Chromium browser tests passed across nine games, including full Reversi rematch, responsive board and reconnect (run 43061255344).
- [ ] Squash-merge feature PR only when both pipelines are green.
- [ ] Deploy exact reviewed commit to existing Render Free Singapore service, verify /health and production logs.
- [ ] Real Android/iOS two-device input and VoiceOver/TalkBack checks remain manual (not covered by Chromium CI).


## Approved Reversi v1 completion — local and online (2026-11-12)

The original online Game #9 release in PR #22 provided the standard eight-direction flipping rules, private room codes and secure reconnection. The approved v1 additionally requires **same-device local play, resignation and full move-history review**; these changes are isolated on `feature/playgrove-reversi-local-history-resign-20261112`.

- A **local two-player** choice on the Reversi entry screen opens a distinct React component with no socket or backend calls. Players can name themselves, take alternating turns on a single device and continue while offline after initial loading.
- The shared pure move engine (`reversi-rules.mjs`) is imported by both server gameplay and local UI; it guarantees equivalent legal moves, captures, disc totals, automatic passes and finishing conditions.
- Local match progress is saved in `playgrove:reversi:local:v1`. A saved match is replay-validated on restore to reject corrupt states; same-device match history and colour-swapping rematches remain browser-only.
- Online rooms record authoritative, immutable board snapshots for the **complete move history**; the history viewer can inspect the starting position and prior moves without changing the server state or allowing a move while reviewing.
- Resignation requires a confirmation dialog. The server authorizes online resignation from the authenticated session and grants the opponent the round; local resignation grants the opposing colour the win. A rematch resets histories and swaps colours. Online rematches still require both players' agreement.
- Disc flipping uses a short transform animation unless `prefers-reduced-motion: reduce` is set.
- Existing seven-game and Hashi functionality, online room tokens, free Render plan and database-free architecture are unchanged.

### Verification and release gates

- [x] Existing online Reversi (PR #22) completed and merged to main before this extension.
- [x] Extract shared rules, implement local match and save, online resignation and full move history.
- [x] Add Node and Chromium tests for the new behaviours and all nine existing games.
- [ ] Pass the complete TypeScript / Node / build check and nine-game Chromium suite on the extension PR.
- [ ] Merge only after CI succeeds, then publish to existing Render Free service; verify production SHA and startup health.
- [ ] Physical iOS/Android two-player testing and screen-reader checks remain manual acceptance criteria.
