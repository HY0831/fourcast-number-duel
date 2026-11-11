import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { io } from 'socket.io-client';
import pg from 'pg';

const DATABASE_URL = process.env.PLAYGROVE_TEST_DATABASE_URL;
// Never run a process-restart integration test against a potentially live DB.
// A dedicated ephemeral database with this exact name is required.
const safe = (() => {
  if (!DATABASE_URL) return false;
  try { return new URL(DATABASE_URL).pathname === '/playgrove_ci'; }
  catch { return false; }
})();

async function reservePort() {
  const s = createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return port;
}

async function launchServer(t, expectFailure = false) {
  const port = await reservePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/index.mjs'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), PLAYGROVE_DATABASE_URL: DATABASE_URL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  t.after(async () => { if (child.exitCode === null) { child.kill('SIGTERM'); await Promise.race([once(child, 'exit'), new Promise(r => setTimeout(r, 2000))]); } });
  for (let attempts = 0; attempts < 110; attempts++) {
    if (child.exitCode !== null) {
      if (expectFailure) return { child, baseURL, output };
      throw new Error('Persistent game server exited before becoming healthy: ' + output.slice(-600));
    }
    try {
      const res = await fetch(`${baseURL}/health`, { signal: AbortSignal.timeout(300) });
      if (res.ok) {
        assert.equal(expectFailure, false, 'A second writer must never accept requests.');
        return { child, baseURL, output };
      }
    } catch { /* Starting up. */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Timed out waiting for persistence startup: ' + output.slice(-600));
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise(r => setTimeout(r, 3000))]);
  assert.notEqual(child.exitCode, null, 'Game server did not stop.');
}

async function socketFor(t, baseURL) {
  const socket = io(baseURL, { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 3500 });
  t.after(() => socket.disconnect());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', err => { clearTimeout(timer); reject(err); });
  });
  return socket;
}

function send(socket, event, payload = {}) {
  return new Promise((resolve, reject) => socket.timeout(6500).emit(event, payload, (error, result) => error ? reject(error) : resolve(result)));
}

test('PostgreSQL restarts restore all three multiplayer games; tokens, secret privacy, turns and single writer survive', { skip: !safe, timeout: 120000 }, async t => {
  const first = await launchServer(t);
  const sessions = {};
  const fourA = await socketFor(t, first.baseURL);
  const fourB = await socketFor(t, first.baseURL);
  sessions.fourA = await send(fourA, 'room:create', { name: 'Alex', mode: 'unique' });
  sessions.fourB = await send(fourB, 'room:join', { name: 'Blair', code: sessions.fourA.code });
  assert.ok(sessions.fourA.ok && sessions.fourB.ok);
  assert.equal((await send(fourA, 'room:secret', { code: '0123' })).ok, true);
  assert.equal((await send(fourB, 'room:secret', { code: '4567' })).ok, true);
  assert.equal((await send(fourA, 'room:guess', { guess: '0000' })).ok, true);

  const bingoA = await socketFor(t, first.baseURL);
  const bingoB = await socketFor(t, first.baseURL);
  sessions.bingoA = await send(bingoA, 'bingo:create', { name: 'Clara' });
  sessions.bingoB = await send(bingoB, 'bingo:join', { name: 'Dina', code: sessions.bingoA.code });
  const board = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.equal((await send(bingoA, 'bingo:board', { board })).ok, true);
  assert.equal((await send(bingoB, 'bingo:board', { board: [...board].reverse() })).ok, true);
  assert.equal((await send(bingoA, 'bingo:call', { number: 1 })).ok, true);

  const connectA = await socketFor(t, first.baseURL);
  const connectB = await socketFor(t, first.baseURL);
  sessions.connectA = await send(connectA, 'connect4:create', { name: 'Evan' });
  sessions.connectB = await send(connectB, 'connect4:join', { name: 'Faith', code: sessions.connectA.code });
  assert.equal((await send(connectA, 'connect4:drop', { column: 2 })).ok, true);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  t.after(() => pool.end());
  const records = (await pool.query('SELECT game_type, code, state FROM playgrove_room_snapshots')).rows;
  assert.deepEqual(records.map(r => r.game_type).sort(), ['bingo', 'connect4', 'fourcast']);
  for (const record of records) {
    assert.equal(JSON.stringify(record.state).includes('socketId'), false);
    assert.equal(record.state.players.length, 2);
  }

  // One database cannot be used concurrently by two independent Playgrove servers.
  const overlapping = await launchServer(t, true);
  assert.notEqual(overlapping.child.exitCode, 0, 'Second process should fail while first holds advisory lock.');

  await stop(first.child);
  const restarted = await launchServer(t);
  const newFA = await socketFor(t, restarted.baseURL);
  const newFB = await socketFor(t, restarted.baseURL);
  const newBA = await socketFor(t, restarted.baseURL);
  const newBB = await socketFor(t, restarted.baseURL);
  const newCA = await socketFor(t, restarted.baseURL);
  const newCB = await socketFor(t, restarted.baseURL);

  const fHost = await send(newFA, 'room:resume', { code: sessions.fourA.code, token: sessions.fourA.token });
  assert.equal(fHost.ok, true);
  assert.equal(fHost.room.phase, 'playing');
  assert.equal(fHost.room.guesses.length, 1);
  assert.equal(fHost.room.revealedSecrets, null);
  assert.equal(fHost.room.players[1].online, false, 'Stale socket presence must never survive restart.');
  const fGuest = await send(newFB, 'room:resume', { code: sessions.fourB.code, token: sessions.fourB.token });
  assert.equal(fGuest.ok, true);
  assert.equal(fGuest.room.turnPlayerId, fGuest.room.you, 'Original turn order must be retained.');
  assert.equal((await send(newFB, 'room:guess', { guess: '1111' })).ok, true);

  const bHost = await send(newBA, 'bingo:resume', { code: sessions.bingoA.code, token: sessions.bingoA.token });
  assert.equal(bHost.ok, true);
  assert.deepEqual(bHost.room.yourBoard, board);
  const bGuest = await send(newBB, 'bingo:resume', { code: sessions.bingoB.code, token: sessions.bingoB.token });
  assert.equal(bGuest.ok, true);
  assert.deepEqual(bGuest.room.called, [1]);
  assert.deepEqual(bGuest.room.yourBoard, [...board].reverse());
  assert.ok(bGuest.room.players.every(p => !('board' in p)), 'Opponent layout must remain secret.');
  assert.equal((await send(newBB, 'bingo:call', { number: 2 })).ok, true);

  const cHost = await send(newCA, 'connect4:resume', { code: sessions.connectA.code, token: sessions.connectA.token });
  assert.equal(cHost.ok, true);
  assert.equal(cHost.room.board.filter(Boolean).length, 1);
  const cGuest = await send(newCB, 'connect4:resume', { code: sessions.connectB.code, token: sessions.connectB.token });
  assert.equal(cGuest.ok, true);
  assert.equal(cGuest.room.turnPlayerId, cGuest.room.you);
  assert.equal((await send(newCB, 'connect4:drop', { column: 3 })).ok, true);
  const finalC = await send(newCA, 'connect4:resume', { code: sessions.connectA.code, token: sessions.connectA.token });
  assert.equal(finalC.room.board.filter(Boolean).length, 2);
});
