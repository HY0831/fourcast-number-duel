// Optional, single-writer PostgreSQL persistence for all three online games.
// Player tokens, Fourcast secrets and private Bingo boards stay server-side.
// Never log snapshot JSON or connection-string credentials.
import { ROOM_TTL_MS } from './game-engine.mjs';

export const SNAPSHOT_VERSION = 1;
export const ROOM_KINDS = Object.freeze([
  { kind: 'fourcast', store: 'games' },
  { kind: 'bingo', store: 'bingos' },
  { kind: 'connect4', store: 'connectFours' },
]);
const KINDS = new Set(ROOM_KINDS.map(item => item.kind));
const LOCK_KEYS = [1346859606, 1380929357]; // Dedicated Playgrove single-writer advisory lock.

function isPlayer(player) {
  return player && typeof player === 'object' &&
    typeof player.id === 'string' && player.id.length >= 16 &&
    typeof player.name === 'string' && player.name.length >= 2 && player.name.length <= 20 &&
    typeof player.token === 'string' && /^[a-f0-9]{64}$/.test(player.token) &&
    typeof player.isHost === 'boolean';
}

function hasValidCommonFields(room) {
  if (!room || typeof room !== 'object' || !/^[A-Z0-9]{6}$/.test(room.code) ||
    !Number.isSafeInteger(room.updatedAt) || room.updatedAt < 0 ||
    !Number.isInteger(room.round) || room.round < 1 ||
    !Number.isInteger(room.turnIndex) || ![0, 1].includes(room.turnIndex) ||
    !Array.isArray(room.players) || room.players.length < 1 || room.players.length > 2 ||
    room.players.some(player => !isPlayer(player))) return false;
  if (room.players[0].isHost !== true || (room.players[1] && room.players[1].isHost !== false)) return false;
  return new Set(room.players.map(p => p.id)).size === room.players.length &&
    new Set(room.players.map(p => p.token)).size === room.players.length;
}

export function serializeRoom(kind, room) {
  if (!KINDS.has(kind)) throw new Error('Unsupported persisted game type.');
  // Socket IDs are ephemeral and must NEVER survive a process restart.
  const state = { ...room, players: room.players.map(({ socketId: _socketId, ...player }) => player) };
  return { kind, code: room.code, updatedAt: room.updatedAt, version: SNAPSHOT_VERSION, state };
}

export function restoreRoom(record, now = Date.now()) {
  if (!KINDS.has(record?.kind) || record.version !== SNAPSHOT_VERSION) {
    throw new Error('Unsupported Playgrove room snapshot schema.');
  }
  const room = record.state;
  if (!hasValidCommonFields(room) || record.code !== room.code ||
      !Number.isSafeInteger(record.updatedAt) || record.updatedAt !== room.updatedAt) {
    throw new Error('Invalid Playgrove room snapshot.');
  }
  if (now - room.updatedAt > ROOM_TTL_MS) return null;
  if (record.kind === 'fourcast') {
    if (!['lobby', 'setup', 'playing', 'finished'].includes(room.phase) ||
      !['repeat', 'unique'].includes(room.mode) || !Array.isArray(room.guesses) ||
      room.players.some(p => typeof p.ready !== 'boolean' ||
        (p.secret !== null && !(typeof p.secret === 'string' && /^\d{4}$/.test(p.secret))))) {
      throw new Error('Invalid Fourcast room snapshot.');
    }
  } else if (record.kind === 'bingo') {
    if (!['lobby', 'setup', 'playing', 'finished'].includes(room.phase) ||
      !Array.isArray(room.called) || !Array.isArray(room.calls) ||
      room.called.some(n => !Number.isInteger(n) || n < 1 || n > 25) ||
      new Set(room.called).size !== room.called.length ||
      room.players.some(p => typeof p.ready !== 'boolean' || (p.board !== null &&
        (!Array.isArray(p.board) || p.board.length !== 25 ||
         new Set(p.board).size !== 25 || p.board.some(n => !Number.isInteger(n) || n < 1 || n > 25))))) {
      throw new Error('Invalid Bingo room snapshot.');
    }
  } else if (record.kind === 'connect4') {
    if (!['lobby', 'playing', 'finished'].includes(room.phase) ||
      !Array.isArray(room.board) || room.board.length !== 42 ||
      room.board.some(n => ![0, 1, 2].includes(n)) ||
      !Array.isArray(room.winningCells)) {
      throw new Error('Invalid Connect Four room snapshot.');
    }
  }
  return { ...room, players: room.players.map(p => ({ ...p, socketId: null })) };
}

export function snapshotStores(stores) {
  return Object.fromEntries(ROOM_KINDS.map(({ store }) => [
    store, new Map([...stores[store].rooms].map(([code, room]) => [code, structuredClone(room)])),
  ]));
}

export function roomDiff(before, stores) {
  const updates = [], deletes = [];
  for (const { kind, store } of ROOM_KINDS) {
    const older = before[store];
    const current = stores[store].rooms;
    for (const [code, room] of current) {
      const item = serializeRoom(kind, room);
      const previous = older.get(code);
      if (!previous || JSON.stringify(serializeRoom(kind, previous).state) !== JSON.stringify(item.state)) updates.push(item);
    }
    for (const code of older.keys()) if (!current.has(code)) deletes.push({ kind, code });
  }
  return { updates, deletes };
}

export class PgRoomRepository {
  constructor(pool) { this.pool = pool; this.lockClient = null; }

  async initialize(stores) {
    this.lockClient = await this.pool.connect();
    try {
      const result = await this.lockClient.query('SELECT pg_try_advisory_lock($1, $2) AS locked', LOCK_KEYS);
      if (!result.rows[0]?.locked) throw new Error('Another Playgrove server already owns the room database.');
      await this.lockClient.query(`
        CREATE TABLE IF NOT EXISTS playgrove_room_snapshots (
          game_type text NOT NULL CHECK (game_type IN ('fourcast','bingo','connect4')),
          code varchar(6) NOT NULL,
          schema_version smallint NOT NULL,
          updated_at_ms bigint NOT NULL,
          state jsonb NOT NULL,
          PRIMARY KEY (game_type, code)
        )`);
      const now = Date.now();
      await this.lockClient.query('DELETE FROM playgrove_room_snapshots WHERE updated_at_ms < $1', [now - ROOM_TTL_MS]);
      const { rows } = await this.lockClient.query(
        'SELECT game_type, code, schema_version, updated_at_ms, state FROM playgrove_room_snapshots'
      );
      const kindToStore = Object.fromEntries(ROOM_KINDS.map(x => [x.kind, x.store]));
      for (const row of rows) {
        // pg normally returns bigint as a string.
        const restored = restoreRoom({
          kind: row.game_type, code: row.code, version: row.schema_version,
          updatedAt: Number(row.updated_at_ms), state: row.state,
        }, now);
        if (restored) stores[kindToStore[row.game_type]].rooms.set(restored.code, restored);
      }
      return rows.length;
    } catch (error) {
      if (this.lockClient) { this.lockClient.release(); this.lockClient = null; }
      throw error;
    }
  }

  async save(before, stores) {
    const { updates, deletes } = roomDiff(before, stores);
    if (!updates.length && !deletes.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of updates) {
        await client.query(`
          INSERT INTO playgrove_room_snapshots (game_type, code, schema_version, updated_at_ms, state)
          VALUES ($1, $2, $3, $4, $5::jsonb)
          ON CONFLICT (game_type, code)
          DO UPDATE SET schema_version=EXCLUDED.schema_version,
                        updated_at_ms=EXCLUDED.updated_at_ms, state=EXCLUDED.state
        `, [item.kind, item.code, item.version, item.updatedAt, JSON.stringify(item.state)]);
      }
      for (const item of deletes) {
        await client.query('DELETE FROM playgrove_room_snapshots WHERE game_type=$1 AND code=$2', [item.kind, item.code]);
      }
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Database connection may be gone. */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.lockClient) {
      try { await this.lockClient.query('SELECT pg_advisory_unlock($1, $2)', LOCK_KEYS); }
      finally { this.lockClient.release(); this.lockClient = null; }
    }
    await this.pool.end();
  }
}

export async function createRoomRepository(connectionString, stores) {
  if (!connectionString) return null;
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString,
    max: 4,
    connectionTimeoutMillis: 4000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    application_name: 'playgrove-rooms',
  });
  const repository = new PgRoomRepository(pool);
  try {
    await repository.initialize(stores);
    return repository;
  } catch (error) {
    await pool.end();
    throw error;
  }
}
