# Playgrove V5 — Durable Multiplayer Room Recovery

Status: **implemented and merged into `main` via PR #17, production activation pending** (2026-11-11)
Branch: `feature/playgrove-v5-persistent-rooms-20261111`

## Purpose

Fourcast, Bingo Duel and Connect Four currently store active rooms in process memory. Server restarts and Render sleeps therefore lose all matches. V5 adds **opt-in PostgreSQL snapshots** of complete server-authoritative rooms while keeping room codes, existing per-browser tokens, gameplay rules, and the Socket.IO protocol unchanged.

All other games remain local-browser-only. This version does not add online accounts or cloud sync for solo games.

## How it works

1. When `PLAYGROVE_DATABASE_URL` is **unset**, the server retains its existing in-memory behavior. No database connection, migration, or startup requirement is introduced. This makes an ordinary GitHub merge backward-compatible.
2. When the variable is set, startup connects to the dedicated PostgreSQL database, obtains an exclusive **PostgreSQL advisory lock** (single game server writer), and creates `playgrove_room_snapshots` if necessary. The server does not accept HTTP/WebSocket connections until it has successfully recovered unexpired rooms.
3. The table has one row per game type + six-character room code, containing schema version 1, last activity timestamp, and a JSONB copy of server-authoritative state. Snapshots include *private* Fourcast secret codes, private Bingo boards, and player session tokens. **Session tokens are stored in their existing plaintext hexadecimal form** to preserve the established reconnect protocol. Treat the database as highly sensitive.
4. Socket IDs are **never stored**. All players start offline after process restart; a browser uses its existing room code and token in the current `*:resume` event to reclaim the same seat. Once both players reconnect, the game can continue with the same board, locked numbers, turns and scores.
5. Each mutating socket request is serialized within the Node process, saved inside a PostgreSQL transaction, and only then acknowledged and broadcast. Changes to different rooms are written separately rather than replacing the entire database.
6. Failed user actions roll back their in-memory changes. An unknown database write outcome is **fail-closed**: the process exits and is restarted by its supervisor rather than continuing with potentially divergent state.
7. Expired rooms retain the **original 3-hour inactivity TTL**. Expired database rows are purged on startup and on the periodic cleanup path.

### Storage contract

`server/room-persistence.mjs` owns serialization, strict schema checks, recovery and parameterized queries. PostgreSQL is accessed using the `pg` driver. Transactions run on one checked-out client and include `BEGIN`, all relevant changes, and `COMMIT` or `ROLLBACK`.

A single PostgreSQL advisory lock prevents two independent Playgrove server processes from mutating the same room data concurrently. V5 **does not support horizontal scaling** of Socket.IO workers. Run **one backend instance** in production. A deployment with overlapping old and new processes may have to wait for the old process to terminate before the new one can obtain the lock.

### Database schema

Created on first enabled startup (or provision it ahead of time via a privileged migration):

```sql
CREATE TABLE IF NOT EXISTS playgrove_room_snapshots (
  game_type text NOT NULL CHECK (game_type IN ('fourcast','bingo','connect4')),
  code varchar(6) NOT NULL,
  schema_version smallint NOT NULL,
  updated_at_ms bigint NOT NULL,
  state jsonb NOT NULL,
  PRIMARY KEY (game_type, code)
);
```

This table must be in a **dedicated Playgrove database**; do not reuse the Galaxy System, finance, or academic project databases.

## Deployment and configuration (requires approval and an idle multiplayer window)

1. Provision a dedicated persistent PostgreSQL instance in the same region as the Render web service. Confirm price/plan, backups, access control, and database lifecycle before provisioning. No Render database has been created by this change.
2. Grant the Playgrove server user access only to its own database/table. Ensure backups and TLS are configured appropriately for that provider.
3. On the **one** Playgrove Render web service, set the secret `PLAYGROVE_DATABASE_URL` to the PostgreSQL connection URI. Include TLS options if the provider requires them. **Do not commit the URI or paste credentials into GitHub, logs, or this document.**
4. Schedule an idle-room deployment window. The first activation cannot migrate old **in-memory** games from an already-running process. Starting with an empty database therefore loses any outstanding older room sessions; notify active players first.
5. Deploy and verify `/health`, the server's non-secret `durable rooms enabled` startup log, and two-browser create/lock/play/reload behavior. Then validate stop/restart/recover on the approved preview environment.
6. Check that both players appear offline immediately after restart, can reclaim their rooms, and can continue the correct turn after both reconnect.
7. Keep the old production environment/previous code available for a controlled recovery plan. **Do not roll back to an old in-memory-only build assuming it will keep saving database moves.** Database-backed and non-database-backed modes must not both serve the same users.
8. If PostgreSQL is unavailable or cannot obtain the writer lock, startup must **fail**, not silently degrade to ephemeral memory. Fix the connection or database before restarting service.

The database setting is opt-in; **a merge by itself is not a production activation**. Render workspace inspection and database provisioning have not been performed because the account requires explicit workspace selection.

## Security and maintenance

- PostgreSQL snapshots store session bearer tokens, secret Fourcast numbers and private Bingo boards. Do not expose table data through browser endpoints, public database REST APIs or anonymous database grants.
- No game-room state is logged. The existing per-viewer `publicRoom` / `publicBingoRoom` / `publicConnectFourRoom` functions continue to control private data in sockets.
- A snapshot schema-version mismatch or malformed data fails startup so players cannot silently lose corrupt or newer-version games. A future schema change requires a documented migration.
- A 3-hour inactivity TTL is preserved, not extended indefinitely by the database.
- Backups, retention, GDPR/PDPA obligations, credential rotation, alerting, and backup restoration testing should be finalized before actual production activation.

## Automated checks

- `tests/room-persistence.test.mjs`: snapshots, recovery of each game, 3-hour expiration, invalid tokens/schema rejection, socket ID removal, changed-room isolation, and play after two-token restoration.
- `tests/room-postgres.integration.mjs`: a **real** separate PostgreSQL database on CI; boot game server, create and play all three games, reject a second concurrent writer, stop process, start a replacement process, resume all seats, check privacy and continue moves.
- `.github/workflows/room-postgres.yml`: ephemeral `postgres:16` service with dedicated `playgrove_ci` database. Integration test **refuses to run** against any different database name. No production connection is used by CI.
- Existing `npm run check`: TypeScript, Node unit tests, Vite build.
- Existing Playwright Chromium suite: seven-game browser regressions, unchanged Socket.IO names and client behavior.

## Exit criteria

- [x] TypeScript + 99 Node tests + Vite build passed ([CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43039488266)).
- [x] Real PostgreSQL restart/recovery and exclusive-writer workflow passed ([CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43039488097)).
- [x] All 45 Chromium Playwright tests passed, no retries ([GitHub CI](https://github.com/HY0831/fourcast-number-duel/actions/runs/43040555783)).
- [x] PR #17 squash-merged to `main` after all three CI gates passed (commit `a1432818`).
- [ ] Provision database and enable environment variable in a separate approved Render release, outside active multiplayer sessions.
- [ ] Test on real phones and verify monitoring/backups before claiming production durability.
