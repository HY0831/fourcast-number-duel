# Playgrove V3 — Multiplayer Reconnection & Presence Integrity

Date: 2026-11-11
Branch: `polish/playgrove-v3-multiplayer-reconnect-20261111`

## Scope

Keep the approved rules, private invitation codes, server-authoritative turns, seven game library, room token formats, and local save keys. This pass examines **Fourcast, Bingo Duel, and Connect Four** under real socket disconnection and reconnection.

### Confirmed risk 1: transport connected before room authorization

The clients previously set their `connected` UI flag immediately when a Socket.IO transport established, before `room:resume`, `bingo:resume`, or `connect4:resume` returned. During that short interval the UI could show an active connected player with stale room state; an attempted action would fail on the server because the new socket was not authorized.

**Fix:** hold the game-ready/online flag until the resume acknowledgment completes. Ignore old acknowledgments received after the socket disconnects. If resume times out, clear the stale displayed room, retain the saved token, and give a clear refresh-to-retry message. If the server definitively rejects resume, continue the existing invalid-session removal behavior.

### Confirmed risk 2: same-socket identity change leaves phantom presence

When one socket resumed a *different valid player token in the same room*, the server previously checked only whether the room **code** had changed. The old seat could retain that socket ID and appear online even though the socket was now attached to another player. This affects all three namespaces.

**Fix:** release the previous seat when either its room code **or its token** differs, then attach the new identity. The Fourcast takeover path now clears the previous socket's abandoned token as well as its room code.

### Live protocol regression tests

New `tests/multiplayer-reconnect.test.mjs` launches a real Node + Socket.IO web service on an ephemeral port and uses independent WebSocket clients:

- **Fourcast:** secret setup; disconnect guest; confirm offline presence and rejection of guesses while disconnected; resume with saved token; confirm same turn, zero lost attempts, no leaked secret; continue the round.
- **Bingo Duel:** lock both boards; disconnect; reject calls while offline; resume both positions without exposing opponent's board; confirm no duplicate calls and correct alternating turns.
- **Connect Four:** preserve the existing disc, board state and turn while offline; reject invalid moves; resume and continue with two players.
- **All three games:** test swapping valid seats on the same socket; the former seat must become offline, never a phantom connected player. The displaced socket can regain only an authorized seat with its own token.

These integration tests supplement (rather than replace) existing pure-engine and seven-game Chromium browser tests.

## What this does NOT change

- No new database or remote persistent room storage. A Render restart or server shutdown still erases in-memory rooms.
- Browser-saved sessions are device/browser-specific, not cloud sync.
- Short disconnect/reconnect is supported **while the current server instance and room remain alive** (room expiration may still apply).
- Does not emulate a real telco handoff between distinct physical networks; tests simulate transport loss, new sockets and token-based recovery.
- Do not modify production Render deployment during development/verification.

## Release checklist

- [ ] GitHub TypeScript + all Node unit/integration tests + Vite production build pass.
- [ ] GitHub Chromium Playwright full seven-game browser suite passes.
- [ ] PR merged only with both check suites passing.
- [ ] Render production deployment assessed separately for impact on existing in-memory rooms.

## Next iterations (not included)

1. Mobile browser network-flap testing (Wi-Fi to mobile-data, page background/foreground) on a safe preview.
2. Keyboard/screen-reader accessibility audit for all seven games.
3. Durable multiplayer rooms across process restarts, designed with safe database-backed session expiry and migration.
