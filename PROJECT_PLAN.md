# Fourcast — Project Plan & Progress

_Last updated: 2026-11-07_

## Goal

Build a simple, good-looking mobile-first, online multiplayer four-digit guessing game that friends can play on Wi-Fi using a private invite code.

## Confirmed game mechanics

| Area | MVP decision |
| --- | --- |
| Players | 2 players per private room; many rooms supported |
| Mode A | Repeatable digits (`0011`, `7777` both valid) |
| Mode B | Unrepeatable digits (`0123` valid; `0012` invalid) |
| Secrets | Each person locks their own hidden four-character digit string |
| Turn | One guess at a time, strictly alternating |
| Match feedback | Count of digits in exact correct positions only, never which positions |
| Victory | First to guess all 4 positions correctly wins immediately |
| Start order | Host round 1, second player round 2, alternates for rematches |
| Disconnect | Game pauses; user can refresh and reclaim their seat |
| After finish | Reveal both codes, offer host-controlled rematch |
| Platform | Mobile web/PWA-ready code, desktop compatible |

## Implemented

- [x] Responsive UI: welcome, create/join, waiting room, secret selection, playing, history, result/rematch
- [x] Private rooms with six-character codes and invite links
- [x] Authoritative realtime multiplayer backend using Express + Socket.IO
- [x] Server-side rules enforcement and turn validation
- [x] Secret numbers excluded from snapshots until round ends
- [x] Room/session reconnect and opponent presence
- [x] Both number modes, 0-leading codes, numeric keypad
- [x] Automated game-engine tests (10 passing; local engine validation)
- [x] Development and production commands + deployment instructions

## Still to do for public launch

- [ ] Create a dedicated GitHub repository (the connected GitHub integration currently cannot create repositories)
- [ ] Push this standalone codebase to the new repository
- [ ] Deploy persistent Node/WebSocket hosting and test from two phones on different networks
- [ ] Add persistent room storage (Redis/PostgreSQL) for server restarts
- [ ] Install frontend dependencies, perform the full typecheck/build, and test on Android and iOS browsers (npm registry blocked in current workspace)
- [x] Mobile web-app manifest and install icons (HTTPS host required for home-screen installation)

## Phase 2 ideas (not part of MVP)

- [ ] 3–6 player rooms and clear target-selection / victory rules
- [ ] Optional timed turns / countdown
- [ ] Leaderboards and per-device wins history
- [ ] Public matchmaking and friend list
- [ ] Animations, subtle sound effects and accessibility polish
- [ ] Bilingual English / Chinese UI

## Architecture notes

One Node process serves Express static React assets and Socket.IO. In development Vite proxies Socket.IO to the Node backend. No pre-existing Galaxy/finance databases, repositories, environments, or deployments were modified. For a public launch with minimal operational complexity, deploy this as a single long-running Node web service; do not deploy the backend to Vercel serverless because it does not provide persistent Socket.IO connections.

## Online-only clarification (2026-11-07)

- Players are in **different locations**, not required to share Wi-Fi.
- Use public HTTPS and WebSocket hosting; deploy the frontend and game server together as a single Render Node web service.
- `render.yaml` specifies Singapore region and free hobby plan; the online guide provides the one-click deployment link.
- GitHub repository: `HY0831/fourcast-number-duel` (new, separate from other projects).
- Rooms currently live in server memory and cannot survive server restart/sleep. Later production enhancement: persist active rooms to durable storage.
