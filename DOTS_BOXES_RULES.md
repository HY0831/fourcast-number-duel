# Playgrove Game #10 — Dots & Boxes

**Status:** approved by owner. Replaces the proposed Wall Race. Existing Game #9 (Reversi) remains unchanged.

## Classic rules
1. Play on a 3×3, 5×5 or 7×7 **box** board, consisting of respectively 4×4, 6×6 or 8×8 dots.
2. Players alternate drawing **one** undrawn horizontal or vertical line between two adjacent dots.
3. Whoever closes the fourth side of a box **owns that box**, and receives **another turn**. Completing two adjacent boxes with a single line grants both boxes but one additional turn (the same player continues).
4. A turn with no completed boxes passes to the other player. Previously drawn lines cannot be replaced, erased or redrawn.
5. The game ends once all boxes are claimed. The player owning more boxes wins; equal scores result in a draw (the current odd-sized boards each have an odd number of boxes, so normal completed rounds cannot tie).
6. Local and online rematches alternate the starting player. Board size remains the same for the rematch; starting a new local match permits a different size.
7. Resignation awards the other player the round. Online players can resign even when it is not their turn.
8. The move history can be reviewed without changing the live board; viewed historical positions cannot accept new moves.

## Modes and interactions
- **Same device:** custom names, browser-local saves and resume, selectable board size, automatic score, extra turns and rematch. No server needed once the game is loaded.
- **Private online:** six-character room codes and shareable /games/dots-boxes?room=ABC123 links. Host selects size, guest joins; only the appropriate authenticated player can draw a line. Server owns game state, validates move index and turn, and broadcasts updated line ownership, boxes and scores.
- **Reconnection:** opaque cryptographically random tokens stored in browser localStorage for the private room; tokens are never returned in opponent snapshots. Rooms are transient and only survive while the same Node process runs.
- **Disconnect protection:** no line may be drawn online until both players are connected. Resume uses the original token. Switching to a different multiplayer game releases the previous socket's Dots seat.
- **Animations:** new line draw and captured-box visual reveal; reduced-motion media preference disables visual animations.
- **Accessibility:** keyboard focusable line targets using Enter/Space, text-based ownership, turn and score indicators, responsive mobile layout.
- **History:** chronological list and replay of prior board state. Online histories are server-authoritative; local histories are validated on restore.
- **No additional infrastructure:** the existing free Render service and Socket.IO server are reused, with no database, external API, user accounts or paid resources.

## Files
- client/src/games/dots-boxes/dots-engine.mjs and dots-engine.d.mts: shared deterministic rules and replay validation.
- server/dots-engine.mjs: in-memory room store, private tokens, secure move server, rematch, resign, timeout.
- server/index.mjs: Socket.IO events dots:create, dots:join, dots:resume, dots:line, dots:resign, dots:rematch, dots:leave, update dots:update.
- client/src/games/dots-boxes/DotsBoxesPage.tsx and dots-boxes.css: game board, setup, online, local and replay UI.
- tests/dots-engine.test.mjs: classic rules and room safety.
- tests/multiplayer-reconnect.test.mjs: real Socket.IO reconnect, seat-switching and box-capture tests.
- e2e/dots-boxes.spec.ts: full interactive Chromium mobile/desktop, local/offline, two-device online, scoring and replay tests.
- client/src/playgrove/PlaygroveHome.tsx, client/src/main.tsx, client/src/playgrove/routing.mjs: route and tenth card.

## Release checklist
- [x] Approved as Game #10, replacing the proposed Wall Race.
- [x] Full 3/5/7 classic box rules engine, local play, real-time online play, history and UI implemented in a separate branch.
- [x] Regression tests for rules, extra turns, two-box captures, security, reconnection, local saves and mobile navigation authored.
- [ ] TypeScript, Node tests and production build pass.
- [ ] All ten-game Playwright Chromium tests pass, no failed/flaky tests.
- [ ] Merge reviewed feature PR into GitHub main only after the gates are green.
- [ ] Verify production Render service auto-deploy or trigger a single release and confirm the exact merged SHA is live.
- [ ] Manual Android/iOS touch and VoiceOver/TalkBack checks remain.
