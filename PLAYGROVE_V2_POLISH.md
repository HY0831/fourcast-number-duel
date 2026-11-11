# Playgrove V2 — Reliability & Recovery Pass

Date: 2026-11-11
Working branch: `polish/playgrove-v2-resilience-20261111`

## Motivation

The existing V1 quality pass already added homepage filters, search, responsive improvements, and code-split routes. This follow-up addresses two concrete failure modes discovered while reviewing the shipped source.

1. **Browser storage unavailable**: Fourcast, Bingo Duel, and Connect Four previously accessed `localStorage` directly in render initializers and room/session actions. Privacy restrictions, browser storage security errors, or quota exceptions could throw and break a multiplayer screen or a room join, even though live game state remains in React and on the server.
2. **Lazy game bundle unavailable**: a stale client tab, interrupted download, or failed code-split module load would otherwise propagate an uncaught React error with no useful recovery UI.

## Implemented

- `safeStorage.ts`: get/set/remove operations catch browser storage errors and preserve all existing storage keys and serialized values. When storage is unavailable, the current online multiplayer game works in memory; **resume after refreshing or switching tabs is not guaranteed**.
- Fourcast, Bingo Duel, and Connect Four use the safe operations in name, session, and draft paths. No backend or Socket.IO changes.
- `GameRouteBoundary.tsx`: an error boundary is mounted per game route, with two accessible actions—**Try again** (full reload to fetch current chunks) and **Back to Game Library** (recover without reloading the hub).
- Shared CSS follows the existing Playgrove palette and 44px minimum touch targets.
- New Chromium tests simulate an aborted Nonogram JavaScript chunk and blocked browser storage while creating each multiplayer room.

## Invariants

- All seven game engines, existing rules, secrets, room protocols, save keys, and server APIs stay unchanged.
- Existing browser saves remain readable; the patch does **not** introduce cross-device saves, a new database, offline multiplayer, or persistent server rooms.
- An unreachable game module does not prevent access to other games.
- Never clear saved player data automatically after a failed download.

## Verification

- Required: GitHub `npm run check` (TypeScript, Node suite, Vite production build).
- Required: GitHub `npx playwright test` (seven-game Chromium suite plus new recovery and storage-denial tests).
- Merge only if both checks pass.
- Render deployment is separate; avoid restarts during active multiplayer rooms because room state is still in memory.

## Next recommended audits

1. Network reconnection and degraded connections with two browsers across Fourcast, Bingo Duel, and Connect Four.
2. Complete keyboard and screen-reader walkthrough for each of the seven games, including live result announcements.
3. Persistent server-owned room state after explicit design approval and infrastructure planning (Redis/PostgreSQL; never imply currently supported).
