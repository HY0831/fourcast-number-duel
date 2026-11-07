# Fourcast — The Number Duel

A polished, mobile-first **real-time multiplayer number-guessing game**. Players join a private room from two phones, each choose a secret four-digit code, then alternate guesses. Only digits in the **correct position** count. First to get **4/4 exact matches** wins.

## Game rules

1. One player **creates a room** and chooses **No repeats** (e.g. `1234`) or **Repeatable** (e.g. `1112`).
2. They send the **six-character room code** or invite URL to a second player.
3. Both players pick a secret **4-digit string** (leading `0` is allowed) and lock it. Their secrets are never sent to the opponent before the match ends.
4. The server selects the first guesser (host first in round 1; switches on subsequent rounds).
5. On their turn, a player enters four digits and submits a guess of the **other player's secret**.
6. The only hint is the **number of digits at the exact correct position**, `0/4` through `4/4`. No other hint is given. Example: secret `1234`, guess `4321` → **0/4**, even though all four digits exist.
7. The first player to receive `4/4` wins immediately. Both codes are revealed at the end. Host can initiate a rematch.
8. If either player disconnects, guessing is paused until they return; browser refreshes automatically resume reserved seats from a locally stored session token.

## Features

- Real-time turns and live guess history with Socket.IO
- Two rulesets: repeatable or unique digits, enforced **on the server** for both secrets and guesses
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