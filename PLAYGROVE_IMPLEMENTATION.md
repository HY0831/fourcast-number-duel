# Playgrove — Game Hub Homepage v1

**Status:** Implemented on a separate branch, automated checks passed, and merged to `main` as PR #1.

## Scope

- Adds a separate Playgrove Game Library homepage at `/`, with branded hero, available Fourcast card, coming-soon information and optional saved-session card.
- Moves the Fourcast entry screen behind `/games/fourcast` without changing Fourcast game rules, Socket.IO event names, room membership logic or server implementation.
- Introduces `All games` navigation in Fourcast, with a confirmation when a game is in setup or playing. Returning to the library retains the existing local room token so the user can re-enter the game.
- Supports existing invites `/?room=ABC123` by replacing their URL with `/games/fourcast?room=ABC123`, which goes straight to Fourcast's Join tab and keeps the code.
- New invitations sent from Fourcast use `/games/fourcast?room=ABC123` because its existing share-link helper uses the current browser path.
- Changes page title per route and updates install-manifest display branding. Existing Fourcast favicon artwork remains for the initial migration.

## UI decisions

- Playgrove uses the same Seedling, Sow, Redwood, Terracotta, Rainfall, Foliage, Sprout, Mist and Pebble palette as Fourcast.
- The homepage has no login, search box, inactive interactive controls or fake playable games.
- Fourcast's entire game UI remains intact; the only visible addition inside it is the `All games` back link.
- Mobile-first layout: responsive game card and clear touch targets; semantic main/sections and keyboard focus indicators.
- Homepage code and styles are isolated under `client/src/playgrove` to reduce regression risk.

## Compatibility and routing

| Input | Expected result |
| --- | --- |
| `/` | Playgrove homepage |
| `/games/fourcast` | Fourcast Create/Join page; recover saved room when one is available |
| `/games/fourcast?room=ABC123` | Fourcast Join page, room code prefilled |
| `/?room=ABC123` | Canonical redirect to Fourcast Join page, room code preserved |
| Unknown route | Canonical redirect to `/` |
| Return to library in active match | Warn the player, keep saved session, mark them offline until returning |
| Resume Fourcast | Mount original Fourcast component; reconnect using existing token |

## Technical design

- `PlaygroveHome.tsx`: Presentational homepage with callbacks for playing/resuming Fourcast.
- `playgrove.css`: `pg-`-prefixed classnames, no changes to the Fourcast base stylesheet.
- `routing.mjs` + `routing.d.mts`: Pure route resolver with TypeScript declaration and Node tests.
- `main.tsx`: Small route switch and navigation guard around the existing Fourcast component.
- `server/index.mjs` unchanged: existing Express catch-all serves the React entry document for direct links, Socket.IO remains same-origin.

## Acceptance checklist

- [x] Local route tests: homepage, Fourcast deep link, old invite redirect, sanitization and unknown routes.
- [x] New component TypeScript syntax transpilation check.
- [x] Scoped homepage CSS syntax check.
- [x] GitHub Actions: TypeScript, all engine and route tests, and Vite production build.
- [x] Automated Chromium smoke test: route navigation, old invites, create/join from two independent sessions, repeated-digit guesses, per-player history, active-game navigation, resume and rematch.
- [x] Automated browser layout checks at 320px, 390px and 1440px without horizontal overflow. A human visual review on physical phones remains optional.
- [x] Merge to `main` after both workflows pass (squash commit `4f28ae9`).
- [ ] Verify deployment of `4f28ae9` on Render; the previously-live commit is `16c7610`. Auto-deploy from this public-repo Render service has not been observed.

## Deployment precautions

The existing Render web service is configured for `main`. Pushing this feature branch must not affect the live Fourcast app. Do not create or modify production databases for this homepage phase. The existing in-memory multiplayer rooms still reset on server restarts/sleep, so schedule production promotion when games are not active.

## Verification links (2026-11-08)

- Standard tests on `main`: https://github.com/HY0831/fourcast-number-duel/actions/runs/42439196050
- Browser smoke suite on feature branch: https://github.com/HY0831/fourcast-number-duel/actions/runs/42439067601
- Merged PR: https://github.com/HY0831/fourcast-number-duel/pull/1
- Live web host: https://fourcast-number-duel.onrender.com (deployment of the new homepage still pending at the time of this update).
