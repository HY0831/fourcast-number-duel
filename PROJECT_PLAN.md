# Fourcast — Project Plan & Progress

_Last updated: 2026-11-08_

## Goal

Build a simple, good-looking mobile-first, online multiplayer four-digit guessing game that friends can play from different locations using a public internet connection and private invite code (Wi-Fi or mobile data).

## Confirmed game mechanics

| Area | MVP decision |
| --- | --- |
| Players | 2 players per private room; many rooms supported |
| Mode A | Repeatable digits (`0011`, `7777` both valid) |
| Mode B | Unrepeatable **secret** digits (`0123` valid; `0012` invalid as a secret) |
| Secrets | Each person locks their own hidden four-character digit string; only secrets obey the selected uniqueness rule |
| Guesses | All four-digit guesses may repeat digits in either mode; exact-position scoring remains unchanged |
| History | Separate Player 1 and Player 2 cards with latest-first attempts and independent expand/collapse |
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
- [x] Both secret-number modes, repeatable guesses in both modes, 0-leading codes and numeric keypad
- [x] Separate, independently expandable Player 1 / Player 2 guess histories
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
- Render `vite: not found` diagnosed as `NODE_ENV=production` omitting `devDependencies` during `npm install`. Build step now uses `npm install --include=dev --no-audit --no-fund && npm run build`; Vite and its React plugin were also moved to runtime dependencies as a fallback for existing Render services that still use the original build command; Node engine pinned to 22.x LTS.
- Validate deployment via Render build logs and `/health`; app is not considered deployed until Render reports success.
- Reminder: Render Free sleep/restarts reset active in-memory games; game sessions are not persistent yet.

## Gameplay refinement (2026-11-08)

- Unrepeatable mode now applies **only** when locking a secret; users can enter and submit repeated-digit guesses in either mode. Server-side validation has its own guess validator to prevent rules mismatching the UI.
- Both players' guess histories are separated and labelled Player 1 / Player 2. Cards show their own attempt count, newest guesses first, and independent Show all controls.
- Test coverage expanded for repeated guesses and malformed guess rejection. Palette preserved.

## Playgrove Homepage v1 — feature branch (2026-11-08)

- Working platform name: **Playgrove**. Fourcast remains the first standalone playable game.
- Feature branch: `feature/playgrove-homepage-v1`; development is isolated from Render production `main`.
- Added a mobile-first Game Library homepage and shared navigation using the existing 9-colour palette.
- Routes: `/` for library; `/games/fourcast` for original game; `/?room=ABC123` preserved via canonical redirect.
- Navigation from an active match warns before returning to Game Library. Existing browser session token is retained to resume; expired sessions still fall back to existing error handling.
- No changes to `server/`, Fourcast game-engine rules, existing Socket.IO events or Fourcast per-player histories.
- Pure routing tests included; GitHub Actions TypeScript/unit/build check required before merge.
- **Do not merge** until browser smoke tests on the feature branch or a preview have verified cross-device create/join/share/reconnect/rematch, and the UI at mobile/desktop widths.

## Playgrove implementation verified and merged (2026-11-08)

- Playgrove v1 was developed on `feature/playgrove-homepage-v1`, with Fourcast gameplay and server untouched.
- Unit/TypeScript/production build passed. Automated Chromium checks passed at 320px, 390px and desktop, including real two-session multiplayer, old invitations, separate guess histories, resume and rematch.
- Merged PR #1 into `main` using squash commit `4f28ae9edfa4bbbe88f9dbc98e038237379e1423`.
- Render currently serves the preceding Fourcast commit `16c76109e95b4ce108e370d4c50945b67ded76cd`; the new game hub requires a successful redeployment. The Render service reports auto-deploy enabled, but no commit-triggered deployment was observed.


## Second game — Sudoku (2026-11-08)

- Feature branch: `feature/playgrove-sudoku-v1`, created from the latest `main`.
- Added single-player 9×9 Sudoku as the second Playgrove game, available at `/games/sudoku`.
- Difficulty design is logic-based, not just an arbitrary name: Easy uses naked singles, Medium requires hidden singles, Hard exceeds basic singles; 43/34/29 starting clues. Nine curated uniquely solvable seeds are transformed through Sudoku-preserving permutations for variety.
- Accessible keypad and keyboard entry, notes, hints, undo, pause, timer, highlights for incorrect values, and a completion screen.
- Saved progress and per-level best times in browser localStorage; a new puzzle can be started on demand.
- Fourcast game engine, server Socket.IO events, existing room links and gameplay behavior remain unchanged.
- New Sudoku unit tests and Playwright browser tests must pass on GitHub before merging to `main`.

## Third game — Bingo Duel (2026-11-09)

- Approved rules: 2-player private-room Bingo; **five completed lines wins** (rows, columns and both diagonals), simultaneous five lines is a **draw**.
- **Fully manual board setup**: users select any cell and enter all unique numbers from 1 to 25; no auto-fill/shuffle; errors and duplicates blocked; drafts saved locally; both players lock valid boards before playing.
- Players take turns calling unused numbers; each call marks both boards automatically. Server checks whose turn it is, online status, call uniqueness, line completion and winner.
- Private board positions until game ends. Own board visible, opponent line progress visible, rematch boards reset, next round alternates first player.
- Bingo-specific `bingo:*` Socket.IO events, separate room/session store; original Fourcast engine and Sudoku remain unchanged.
- Route `/games/bingo`; old Fourcast invitation URLs remain compatible. Playgrove homepage has 3 games.
- Branch `feature/playgrove-bingo-manual-v1`; check unit + browser tests before merge. See `BINGO_RULES.md`.
