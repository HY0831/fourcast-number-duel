# Fourcast — Project Plan & Progress

_Last updated: 2026-11-08_

## Goal

Build a simple, good-looking mobile-first, online multiplayer four-digit guessing game that friends can play from different locations using a public internet connection and private invite code (Wi-Fi or mobile data).

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

- [x] Dedicated GitHub repository created by user: `HY0831/fourcast-number-duel`
- [x] All 21 source/project files pushed to `main` on GitHub
- [ ] Approve and deploy the Render Blueprint (public Node/WebSocket service) and test from two phones on different networks
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

## Publishing note (2026-11-07)

- GitHub upload completed on branch `main`, commit `6aaaae3b6c6e711cbb3a550418de06c3fdc73f24`.
- Latest local validation: 10 of 10 Node game-engine tests passed. Frontend package installation and full production build have not yet been verified because npm registry access was unavailable in the current environment.
- A Render plugin was connected, but deployment controls did not become callable within this active tool session; the one-click [Render Blueprint](https://render.com/deploy?repo=https://github.com/HY0831/fourcast-number-duel) is prepared for deployment approval. No public gameplay URL has been verified yet.

## Palette and Render build repair (2026-11-08)

- Applied nine supplied palette colors on every UI stage (home/create/join, waiting room, secret lock, active game/history, finished/rematch) in `client/src/theme.css`, with original base CSS recolored to remove legacy purple/mint branding.
- Recolored favicon, PNG app icons, browser theme and install manifest for consistent branding. Game logic and Socket.IO interactions unchanged.
- Render `vite: not found` diagnosed as `NODE_ENV=production` omitting `devDependencies` during `npm install`. Build step now uses `npm install --include=dev --no-audit --no-fund && npm run build`; Vite remains a devDependency. Node engine pinned to 22.x LTS.
- Validate deployment via Render build logs and `/health`; app is not considered deployed until Render reports success.
- Reminder: Render Free sleep/restarts reset active in-memory games; game sessions are not persistent yet.