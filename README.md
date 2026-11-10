# Playgrove — Online Multiplayer Game Hub

**Playgrove** is a mobile-first library of private multiplayer games for friends in different places. Fourcast is our first game; its real-time multiplayer mechanics are preserved.

## Available Games

- **Connect Four** — online 2-player 7×6 disc-drop strategy game. Play in private rooms; four connected discs win, full board without a win is a draw. Both players approve rematches, and active sessions resume after reconnecting. Play at `/games/connect-four`. See [CONNECT_FOUR_RULES.md](CONNECT_FOUR_RULES.md).

- **Fourcast** — 2-player real-time online number duel, with private room invitations, distinct secret-code modes, per-player guess histories and rematches.
- **Minesweeper** — classic solo puzzle with Easy (9×9, 10 mines), Medium (16×16, 40 mines), and Hard (30×16, 99 mines). First-click safety, reveal/flag controls, timer, pause, local progress saving and best times. Play at `/games/minesweeper`.
- **Bingo Duel** — 2-player turn-based online Bingo, with **tap-to-fill or optional Random 5×5 boards**, numbers 1–25 without repeats, **5 lines to win**, private layouts, line scoring, simultaneous-draw handling, private room invitations and rematches. Play at `/games/bingo`. See [BINGO_RULES.md](BINGO_RULES.md).
- **Sudoku** — single-player 9×9 number puzzle, featuring **Easy, Medium and Hard** levels. Includes pencil notes, hints, undo, pause, timer, mistake indicators, local progress save/resume and best-time tracking. Each puzzle has exactly one solution. Play at `/games/sudoku`.

Fourcast is unchanged: its current real-time server, URL and existing invitation links still work. Sudoku runs entirely on the client and does not need an account or a multiplayer room. See [SUDOKU_DESIGN.md](SUDOKU_DESIGN.md) for difficulty validation and technical details.

## Explore Playgrove

- `/` — Playgrove Game Library: available Fourcast card, game introduction, coming-soon panel and saved-session prompt.
- `/games/connect-four` — real-time private Connect Four rooms (invites with `?room=ABC123`).
- `/games/minesweeper` — solo Minesweeper with three classic difficulty levels.
- `/games/bingo` — multiplayer Bingo Duel, private invites at `/games/bingo?room=ABC123`.\n- `/games/sudoku` — single-player Sudoku (Easy / Medium / Hard).\n- `/games/fourcast` — the existing Fourcast create/join and gameplay experience.
- `/games/fourcast?room=ABC123` — a direct Fourcast invitation that pre-fills the join code.
- `/?room=ABC123` — **old Fourcast invitation links still work** and are automatically redirected to the game route.

The `All games` navigation on Fourcast returns to Playgrove. If a match is active, the player receives a warning and can return later using the saved session. The client retains the existing local session key and server-side game rules.

See [PLAYGROVE_IMPLEMENTATION.md](PLAYGROVE_IMPLEMENTATION.md) for implementation decisions and the branch testing checklist.

## Fourcast — The Number Duel

A polished, mobile-first **real-time multiplayer number-guessing game**. Players join a private room from two phones, each choose a secret four-digit code, then alternate guesses. Only digits in the **correct position** count. First to get **4/4 exact matches** wins.

## Game rules

1. One player **creates a room** and chooses **No repeats** (e.g. `1234`) or **Repeatable** (e.g. `1112`) for players' **secret codes**.
2. They send the **six-character room code** or invite URL to a second player.
3. Both players pick a secret **4-digit string** (leading `0` is allowed) and lock it. Their secrets are never sent to the opponent before the match ends.
4. The server selects the first guesser (host first in round 1; switches on subsequent rounds).
5. On their turn, a player enters four digits and submits a guess of the **other player's secret**. **Every guess may repeat digits**, even in No repeats mode.
6. The only hint is the **number of digits at the exact correct position**, `0/4` through `4/4`. No other hint is given. Example: secret `1234`, guess `4321` → **0/4**, even though all four digits exist.
7. The first player to receive `4/4` wins immediately. Both codes are revealed at the end. Host can initiate a rematch.
8. If either player disconnects, guessing is paused until they return; browser refreshes automatically resume reserved seats from a locally stored session token.

## Features

- Real-time turns and **separate Player 1 and Player 2 guess histories**, each independently expandable, with Socket.IO
- Two secret-code rulesets: repeatable or unique digits, enforced **on the server when locking a secret**; guesses can always repeat digits
- Private invite-code rooms, nickname entry, share/copy, reconnection
- Secret codes never included in room broadcasts until the round is finished
- Mobile-friendly number keypad (including `0`), large touch targets, clear feedback
- Installable-style web app manifest and app icons for supported mobile browsers (needs HTTPS hosting)
- Rematch with alternating starting player
- Multiple simultaneous **2-player** rooms (larger groups can be added later)
- No user account required

## Play over the internet (different locations)

**This game is intended for friends playing from different locations.** Each player only needs a browser and an internet connection (Wi-Fi **or** mobile data). They do **not** need to be on the same network or run a server themselves.

**First deploy the full-stack game to a Node host with WebSocket support.** A Render Blueprint is included to deploy the React frontend **and** real-time game server together in Singapore:

**[Deploy Fourcast to Render](https://render.com/deploy?repo=https://github.com/HY0831/fourcast-number-duel)**

See **[ONLINE_SETUP.md](ONLINE_SETUP.md)** for step-by-step public deployment and how to share the game with a friend. The GitHub repository page is *not* itself the playable game URL.

After it is hosted, the host creates a private room and sends an invite link or six-character room code to the other player. Players can connect from different cities or countries.

## Local development

Requires **Node.js 22.x** and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:5173` on your computer to develop locally. Local development is **optional** and does not enable internet play; follow the online deployment guide above for players in different locations.

To test in two desktop browser sessions, open two separate browsers or an incognito window (each player needs separate localStorage).

## Build and run

```bash
npm run check   # TypeScript, unit tests, and production build
npm start       # Starts the built full-stack server on port 3001
```

`npm start` serves the frontend and WebSocket backend from the same Node process at `http://localhost:3001`. Set `PORT` as needed.

### Hosting

Deploy to a **persistent Node.js hosting provider that supports WebSockets** (e.g., a Node web service on Render, Railway, or Fly.io). Build: `npm install --include=dev --no-audit --no-fund && npm run build`. Start: `npm start`. Expose the provider's `$PORT`. Share the public HTTPS address with friends; they can play from anywhere using Wi-Fi or mobile data. **Static-only hosting such as GitHub Pages or a Vercel static project will not support live Socket.IO game rooms by itself.**

## Design system

Fourcast uses the nine-colour Seedling/Sow/Redwood palette provided by the project owner. Reusable role tokens and screen-state rules live in `client/src/theme.css` and are imported after the base `style.css`. The palette covers the welcome/room screens, private-code entry, both turn states, history, winner/rematch screens, favicons and PWA theme. All gameplay and networking behavior stays unchanged.

## Structure

```text
client/             React + TypeScript + Vite mobile UI
server/             Express + Socket.IO + authoritative game engine
tests/              Game-engine unit tests
PROJECT_PLAN.md     Roadmap, decisions, game specification
```

## Current MVP constraints

- Room state is stored **in server memory**. A server restart clears active rooms. Rooms expire after 3 hours without activity. **On Render Free, a service with no incoming HTTP/WebSocket activity may spin down after 15 minutes and reset in-memory rooms**; play continuously or use persistent storage before wider release.
- Maximum **two players per room**. Many separate matches can play simultaneously.
- Single server instance. Multi-instance scaling requires a shared room store and Socket.IO adapter.
- Basic invite-code security; not intended for sensitive data, prizes, or money stakes.
- Users must keep the room open or reconnect during games. No push notifications.
- This is a responsive **mobile web app**, not a published native Android/iOS app. It runs directly in the browser without an app-store account.

## Safety and fairness

Server checks the room session, host permissions, turn ownership, room phase, both players' online status, game mode, and guess format. Guesses and matching results are computed on the server; there is no client-provided score or secret reveal. Player sessions are opaque random tokens stored locally. In-memory room data is intentionally temporary.

## License

Private personal project — no license specified yet.