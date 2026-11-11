# Fourcast — Project Plan & Progress

_Last updated: 2026-11-12_

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
- [x] Eight-game Playgrove web service live on Render Free in Singapore, with ninth-game Reversi release in progress.
- [ ] Final real-phone check from two separate networks following the latest release.
- [x] Confirm personal-use hosting: no database, Redis, or extra paid services needed; multiplayer rooms intentionally reset when Render restarts or sleeps.
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

## Bingo Duel — verified and merged (2026-11-09)

- Drafted on `feature/playgrove-bingo-manual-v1`, reviewed under PR #3 and squash-merged to `main` as `2647ba7545089637f9c4041ff1d4bd8f55434d4b`.
- GitHub TypeScript, all unit tests, and Vite build passed on both PR and merged main.
- GitHub browser smoke tests passed across Bingo, Fourcast, Sudoku: manual number placement, duplicate rejection, two-player join, live calls, marks on both boards, reconnect/resume, five-line winner and rematch.
- Main verification: https://github.com/HY0831/fourcast-number-duel/actions/runs/42571786503
- Browser verification: https://github.com/HY0831/fourcast-number-duel/actions/runs/42571597948
- Render still live on prior commit `cbff64c2` as last checked; Bingo becomes publicly playable only after successful deployment of latest `main`. Auto-deploy has historically not triggered even though the Render service displays it as enabled.

## Bingo board setup improvement — Random option (2026-11-09)

- Keep **Manual** placement as the default; introduce an optional **Random** button in Bingo's editable setup controls.
- Random generates a fresh Fisher–Yates shuffle of 1–25, each number exactly once. It asks permission before replacing any existing manual or randomized arrangement.
- Players can clear/replace individual entries after randomizing; existing client-side draft persistence, lock validation, match rules and server code remain unchanged.
- Added deterministic unit coverage of valid random layouts and Playwright two-player coverage for Random, cancel/confirm, manual edits after Random, draft reload and lock.
- Implement in feature branch `feature/bingo-random-board-20261109`, verify CI and browser tests, and merge only when checks pass.

## Bingo simplified board interactions — tap-to-fill and immediate call (2026-11-09)

- Replace Bingo's numeric picker with tap-only board editing. An empty square receives the lowest missing number from 1–25, and a filled square is cleared by tapping it again.
- Retain optional Random generation, reset-with-confirmation, local board draft persistence, server-side validation, private board layout, and the existing five-line rule.
- While playing, one tap on an unmarked number immediately sends `bingo:call`; server marks both players on success. Remove the extra "Call number" confirmation control.
- Add pure unit tests for sequential entry, clearing and number reuse, and update Chromium two-player end-to-end tests for the revised interaction.
- Implement on feature branch `feature/bingo-tap-to-fill-and-call-20261109`; run all tests before merge, and verify Render separately afterward.

## Sudoku highlight contrast fix and proposed fourth game (2026-11-09)

- Confirmed Sudoku used translucent row/column/box highlight backgrounds on the dark board and dark reddish text, which produced poor text contrast; wrong cells had the same issue.
- Replace related, matching, wrong and selected-wrong backgrounds with opaque, high-contrast light tones. Game rules and saved data remain unchanged.
- Added Chromium browser regression test that fills a Sudoku row and checks computed text/background contrast (at least 4.5:1) in incorrect and selected states.
- Separate design-only proposal for Playgrove's fourth game: `MINESWEEPER_PROPOSAL.md`. No Minesweeper implementation until approval.

## Fourth game — Minesweeper (2026-11-10)

- Approved: classic single-player Minesweeper at Easy 9×9/10 mines, Medium 16×16/40, and Hard 30×16/99.
- Implemented an independent minefield engine: mine generation on first reveal, safe opening 3×3 area, adjacent counts, zero flood reveal, optional flags, win on all safe cells, loss on a mine.
- Added game route `/games/minesweeper` and fourth Playgrove card, with responsive scroll/zoom board, touch Reveal/Flag toggle, desktop right-click and keyboard shortcuts, pause, timer, local per-difficulty game saves and best times.
- Added engine unit tests and Playwright browser tests for route/size, mobile controls, resume, loss, and victory. Existing Fourcast, Sudoku and Bingo gameplay/server code untouched.
- Work developed on branch `feature/playgrove-minesweeper-v1-20261110`. See `MINESWEEPER_IMPLEMENTATION.md` and `MINESWEEPER_PROPOSAL.md` for rules and checks. GitHub verification and Render deployment are separate release gates.

## Fifth game — Connect Four (2026-11-10)

- Approved v1: online 2-player Connect Four with 7×6 board, gravity, alternating turns, horizontal/vertical/diagonal four-in-a-row, full-board draws, no timer, separate private rooms.
- Players join by shareable six-character room code; game starts automatically with both present. Creator starts round 1, starting player alternates on accepted rematches.
- Isolated `ConnectFourStore`, server-owned board/turn/winner state, `connect4:*` Socket.IO events, robust disconnect/resume, both players consent to rematch.
- `/games/connect-four` with Playgrove fifth card, mobile-first tap-any-column board, last disc highlight and unmistakable winning-line outline, active room return warning, saved room session.
- All existing Fourcast, Bingo, Sudoku and Minesweeper functionality preserved and tested.
- Implemented on `feature/playgrove-connect-four-v1-20261110` and verified with unit tests, build and Chromium two-player browser regression suite prior to merging. See `CONNECT_FOUR_RULES.md`.

## Sixth game — 2048 (2026-11-11)

- Added classic single-player 2048 on a 4×4 board; matching tiles merge once per move and one tile spawns after each valid move (90% chance of 2, 10% chance of 4). Reach 2048 to win and optionally continue; no moves left means loss.
- Added `/games/2048`, a sixth Playgrove card, an independent pure game engine and responsive UI with touch swipes, keyboard and direction buttons, score/best, one-step undo, browser autosave, and New Game.
- No server, database, or Socket.IO changes; Fourcast, Sudoku, Bingo, Minesweeper and Connect Four remain intact.
- Branch `feature/playgrove-2048-v1-20261111`; TypeScript/unit/build and six-game Playwright browser checks required before merge. See `2048_RULES.md`.

## Seventh game — Nonogram / Picture Logic (2026-11-11)

- Approved fixed curated library expanded from 18 to **30** picture puzzles; exactly **10 Easy (5×5), 10 Medium (10×10), 10 Hard (15×15)**. No random puzzle generator.
- Seven categories (Animals, People, Food, Nature, Objects, Places, Symbols), difficulty filters and picture-name search. Unsolved thumbnails conceal the exact artwork; correct solved pictures reveal authentic pixel art.
- Independent engine checks binary artwork, calculates row/column run clues, validates uniqueness and line-deduction solvability for every authored puzzle. Keep `tests/nonogram-engine.test.mjs` comprehensive so future collection additions are vetted.
- Mobile-first gameplay includes Fill/X toggle, tap-to-clear, desktop right-click, keyboard navigation, Undo, 3 hints, pause, timer, restart and zoomable 10×10 and 15×15 boards with sticky row/column clues.
- Per-picture browser autosave, completed gallery badges, best solve time and replay. No new database or multiplayer endpoints.
- Implement on `feature/playgrove-nonogram-30-v1-20261111` and test all seven Playgrove games (unit, TypeScript, production build, Playwright Chromium) before merging. Render deployment remains a separate release action, and can restart in-memory active rooms.
- See `NONOGRAM_RULES.md` for complete puzzle inventory and rules.

## V1 senior game-developer quality pass — 2026-11-11

**Scope:** preserve all seven game engines and multiplayer protocols. Improve navigation discoverability, home performance, usability and regression coverage without redesigning approved game screens.

- [x] Identify homepage discovery friction with seven cards: add All / Solo / Multiplayer filters and searchable game names/categories.
- [x] Remember filters/search in per-tab session storage, with an empty-state reset and accessible live result counts.
- [x] Lazy-load Sudoku, Bingo, Minesweeper, Connect Four, 2048 and Nonogram routes. Preserve Fourcast as the existing base route and keep all shared room invites backward-compatible.
- [x] Provide an accessible route-loading state, improve filter tap targets and focus styles, compact repeated saved-room banners, and respect reduced-motion preferences on the homepage.
- [x] Add Chromium regression coverage for search, both filters, clear, per-tab persistence, lazy-route navigation and 320–1440px mobile/desktop layout.
- [x] **Release gate:** GitHub TypeScript, unit tests, production build and full seven-game Playwright suite passed for PR #11.
- [ ] **Deployment gate:** deploy separately, avoiding restarts while multiplayer rooms are active.

**Post-V1 ideas (superseded where relevant):** network throttling/slow-device performance measurement and structured multi-browser accessibility testing remain useful. Database-backed rooms and cloud sync are explicitly out of scope for this personal-use game collection.

See `PLAYGROVE_V1_POLISH.md`.


## V2 reliability and recovery polish — 2026-11-11

V1 homepage/search/lazy-route polish is merged in PR #11 (main commit `136ddf64`). This follow-up is a separate, controlled quality pass; see `PLAYGROVE_V2_POLISH.md`.

- [x] Audit Seven-game router and all three multiplayer pages for real runtime failure modes.
- [x] Introduce storage-availability safe access in Fourcast, Bingo Duel, and Connect Four while preserving their existing saved-session keys.
- [x] Add a per-route error boundary with retry and return-to-library actions when lazy game module loading fails.
- [x] Add Chromium test scenarios for blocked localStorage and aborted lazy route download.
- [x] **Release gate:** GitHub TypeScript + Node + production build and full 40-test browser suite passed for PR #12.
- [x] **Merge gate:** PR #12 squash-merged after both checks passed, commit `f15814b9`.
- [ ] **Deployment gate:** coordinate Render deployment separately to avoid interrupting in-memory multiplayer rooms.


## V3 multiplayer reconnect / presence integrity — 2026-11-11

Scope: Fourcast, Bingo Duel, Connect Four. Working branch `polish/playgrove-v3-multiplayer-reconnect-20261111` (see `PLAYGROVE_V3_RECONNECT.md`).

- [x] Audit socket attach/detach and the existing saved-token resume paths for all three online games.
- [x] Close same-room player-seat switching bug that could leave a stale player falsely marked online.
- [x] Update clients so a successful Socket.IO transport connection is **not** treated as a ready room session until `*:resume` has completed.
- [x] Preserve existing tokens on transient resume timeout, remove stale displayed room, and instruct refresh to retry.
- [x] Add real Socket.IO server integration tests: disconnect, blocked action, same-turn recovery, private data, no duplicate moves, same-socket seat takeover.
- [x] **Release gate:** 95 Node tests + TypeScript + production build passed ([CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43027249107)); 40 Chromium tests passed ([browser CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43027249230)).
- [x] **Merge gate:** PR #13 squash-merged into `main` as `933c8196` after successful checks.
- [ ] **Deployment gate:** release independently on Render when multiplayer rooms can be safely interrupted; live deployment not assumed.

Next: mobile network-flap tests and accessibility checks. Persisted server room state was subsequently deemed unnecessary for this two-player project.


## V4 accessibility and mobile UX quality pass — 2026-11-11

All seven published games are retained. Work on `polish/playgrove-v4-accessibility-20261111`, details in `PLAYGROVE_V4_ACCESSIBILITY.md`.

- [x] Fix Sudoku and 2048 keyboard shortcut conflicts with focused controls; synchronize Sudoku visual selection and DOM focus.
- [x] Improve Sudoku notes and Nonogram clue screen-reader descriptions.
- [x] Add concise accessible live announcements for board progress and multiplayer status; do not announce timers every second.
- [x] Add clear create/join and Fourcast mode pressed states, and describe Connect Four column occupancy.
- [x] Improve 320px Sudoku keypad touch height, Bingo outline button height and Nonogram search focus ring.
- [x] Add five Chromium accessibility regression tests covering all seven game experiences.
- [x] **Release gate:** TypeScript + 95 Node tests + Vite build passed ([CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43031520739)); all 45 Chromium tests passed with no retries ([browser CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43031520575)).
- [x] **Merge gate:** PR #15 squash-merged into `main` at `140b1254` after all checks passed.
- [ ] **Device QA:** VoiceOver, TalkBack, NVDA and real mobile touch validation are still required; don't claim full WCAG compliance.
- [ ] **Deploy gate:** Render release separately to protect active server-memory multiplayer rooms.

## Personal-use infrastructure simplification — 2026-11-11

**Decision:** Playgrove is primarily for the owner and their girlfriend. Do not provision a PostgreSQL database, Neon, Redis, additional API service, or paid hosting. Keep the current Singapore Render Free Node/WebSocket service and the existing seven-game product/UI.

- [x] Roll back V5 optional PostgreSQL persistence introduced in PR #17, retaining V1–V4 user experience and V3 safe same-process multiplayer reconnect.
- [x] Restore `server/index.mjs`, `package.json`, and `.env.example` to their verified pre-V5 content; remove `pg` dependency, persistence module, related integration tests, PostgreSQL CI workflow, and superseded database rollout documentation.
- [x] Update README and this backlog for a **memory-only** multiplayer architecture. Fourcast, Bingo Duel and Connect Four room codes and game rules are unchanged.
- [ ] **Verification gate:** run TypeScript, Node unit/integration tests, Vite build, and complete 45-test Chromium browser suite for all seven games.
- [ ] **Merge gate:** squash-merge to `main` only after all CI checks pass.
- [ ] **Release gate:** inspect current Render service and active room count; only publish to Render when a restart will not disrupt a match, verify new commit and `/health`.
- [ ] **Manual QA:** two-device mobile WebSocket lobby/create/join, reconnect while the process remains alive, and solo-game local progress recovery.

**Expected trade-off:** Free-tier server sleep, manual restarts, or deploys erase active multiplayer room states; starting a new room is acceptable. No further infrastructure investment is planned. Original V5 development remains traceable in the merged GitHub history (PR #17), but its database implementation is removed from the current codebase.


## Eighth game — Hashi: Bridges (2026-11-11)

Approved self-contained single-player network deduction game, without a database or server changes. Implementation branch `feature/playgrove-hashi-45-puzzles-20261111`.

- [x] Add **45 fixed curated Hashi puzzles**, 15 per Easy/Medium/Hard; all solver-checked for exactly one valid connected bridge solution.
- [x] Enforce direct nearest-island bridges, horizontal/vertical routing, maximum two, forbidden crossings, island number totals, and whole-network connectivity.
- [x] Add tap and drag island controls, clickable bridge paths, keyboard activation, no-bridge marks, Undo/Redo, three hints, Check, Pause and zoom.
- [x] Add local progress restoration, per-puzzle best times, completed status and the searchable eighth game card / route.
- [x] Add independent engine uniqueness tests and eight-game browser regression coverage.
- [x] **Verification gate:** 103/103 Node tests, TypeScript and Vite production build passed ([CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43053146641)); all 53 Chromium tests passed with no retries ([browser CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43053146775)).
- [x] **Merge gate:** Hashi PR #21 squash-merged into main at d1c7a58b after both suites passed.
- [x] **Render gate:** Hashi became live on Render Free on 2026-11-12 MYT at d1c7a58b.
- [ ] **Manual device QA:** touch/drag and accessibility checks on physical Android/iOS phones remain.

See `HASHI_RULES.md` for rules, 45-puzzle inventory and acceptance criteria. Previous V5 database plan remains canceled.

## Game #9 — Reversi online strategy duel (2026-11-12)

**Approved direction:** Mind-challenging classic strategy game for two, preserving Playgrove's memory-only rooms and free hosting. Branch: feature/playgrove-reversi-online-20261112.

- [x] Authoritative 8×8 Reversi engine with legal flips, automatic forced passes, equal-score draws and final-disc scoring.
- [x] Secure Socket.IO two-player rooms, private invitations, seat-bound tokens, player presence, reconnect, and two-party colour-swapping rematches.
- [x] Mobile-first responsive Black/White board, legal move highlights, scoreboard, move history highlight and status banners.
- [x] Ninth game hub card, /games/reversi route, resume control and navigation warnings.
- [x] Node engine tests, real socket reconnection/seat-release tests and Chromium E2E (pairing, full match, rematch, mobile widths).
- [x] **TypeScript, Node and Vite build:** 116/116 Node tests, TypeScript and production Vite build passed ([CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43061255200)).
- [x] **Nine-game Chromium QA:** 60/60 browser tests passed with no retries, including full Reversi game/rematch and 320px mobile board ([CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43061255344)).
- [ ] Squash-merge PR only after green CI and update backlog with the final test counts.
- [ ] Verify a single Render Free release at exact main commit and inspect health/status.
- [ ] Manual iOS/Android touch, invite sharing, VoiceOver/TalkBack checks still needed.

See REVERSI_RULES.md for full rules and acceptance criteria. No new database, paid infrastructure or external API.
