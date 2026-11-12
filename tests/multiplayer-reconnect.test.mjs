import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { io } from 'socket.io-client';

// Exercise real Socket.IO sockets against the actual Express server rather
// than only testing the pure game stores or mocking player presence.
let server;
let baseURL;
let serverOutput = '';

async function reserveFreePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(err => err ? reject(err) : resolve()));
  return port;
}

before(async () => {
  const port = await reserveFreePort();
  baseURL = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => { serverOutput += String(data); });
  server.stderr.on('data', data => { serverOutput += String(data); });
  let healthy = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) break;
    try {
      const response = await fetch(`${baseURL}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) { healthy = true; break; }
    } catch { /* Server may still be starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(healthy, `Test server did not start: ${serverOutput.slice(-1200)}`);
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
});

async function connected(t) {
  const socket = io(baseURL, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    timeout: 3500,
  });
  t.after(() => socket.disconnect());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket failed to connect')), 5000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
  });
  return socket;
}

function send(socket, event, data = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(3500).emit(event, data, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function nextUpdate(socket, event, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error(`No matching ${event} update`)); }, 5000);
    const listener = room => {
      if (!predicate(room)) return;
      cleanup();
      resolve(room);
    };
    const cleanup = () => { clearTimeout(timeout); socket.off(event, listener); };
    socket.on(event, listener);
  });
}

function online(room, host) {
  return room.players.find(player => player.isHost === host)?.online;
}

test('Fourcast pauses guesses while a player is gone and recovers the same turn and hidden secrets', { timeout: 25000 }, async t => {
  const host = await connected(t);
  const guest = await connected(t);
  const created = await send(host, 'room:create', { name: 'Alex', mode: 'unique' });
  assert.equal(created.ok, true);
  const joined = await send(guest, 'room:join', { code: created.code, name: 'Blair' });
  assert.equal(joined.ok, true);
  assert.equal((await send(host, 'room:secret', { code: '1234' })).ok, true);
  assert.equal((await send(guest, 'room:secret', { code: '5678' })).ok, true);

  const offline = nextUpdate(host, 'room:update', room => room.phase === 'playing' && online(room, false) === false);
  guest.disconnect();
  const paused = await offline;
  assert.equal(paused.turnPlayerId, created.room.you);
  assert.equal(paused.revealedSecrets, null);
  const rejected = await send(host, 'room:guess', { guess: '5678' });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /reconnect/i);

  const recoveredGuest = await connected(t);
  const resumed = await send(recoveredGuest, 'room:resume', { code: created.code, token: joined.token });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.room.phase, 'playing');
  assert.equal(resumed.room.guesses.length, 0);
  assert.equal(resumed.room.turnPlayerId, created.room.you);
  assert.equal(resumed.room.revealedSecrets, null);
  assert.equal(resumed.room.players.every(p => p.online), true);
  const continued = await send(host, 'room:guess', { guess: '1111' });
  assert.equal(continued.ok, true);
  assert.equal(continued.room, undefined); // Room state is emitted privately, not returned in acknowledgements.
});

test('Bingo preserves locked boards and calls across disconnect, then restores turn order', { timeout: 25000 }, async t => {
  const host = await connected(t);
  const guest = await connected(t);
  const created = await send(host, 'bingo:create', { name: 'Alex' });
  const joined = await send(guest, 'bingo:join', { code: created.code, name: 'Blair' });
  assert.equal(created.ok, true);
  assert.equal(joined.ok, true);
  const board = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.equal((await send(host, 'bingo:board', { board })).ok, true);
  assert.equal((await send(guest, 'bingo:board', { board: [...board].reverse() })).ok, true);

  const offline = nextUpdate(host, 'bingo:update', room => room.phase === 'playing' && online(room, false) === false);
  guest.disconnect();
  const paused = await offline;
  assert.equal(paused.yourBoard.length, 25);
  assert.equal(paused.called.length, 0);
  assert.equal((await send(host, 'bingo:call', { number: 1 })).ok, false);

  const recoveredGuest = await connected(t);
  const resumed = await send(recoveredGuest, 'bingo:resume', { code: created.code, token: joined.token });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.room.called.length, 0);
  assert.deepEqual(resumed.room.yourBoard, [...board].reverse());
  assert.ok(resumed.room.players.every(p => p.online));
  assert.ok(resumed.room.players.every(p => !('board' in p)), 'Opponent layout must remain private');
  assert.equal((await send(host, 'bingo:call', { number: 1 })).ok, true);
  assert.equal((await send(recoveredGuest, 'bingo:call', { number: 2 })).ok, true);
  const snapshot = await send(recoveredGuest, 'bingo:resume', { code: created.code, token: joined.token });
  assert.deepEqual(snapshot.room.called, [1, 2]);
  assert.equal(snapshot.room.turnPlayerId, created.room.you);
});

test('Connect Four keeps board and correct turn during an opponent reconnect', { timeout: 25000 }, async t => {
  const host = await connected(t);
  const guest = await connected(t);
  const created = await send(host, 'connect4:create', { name: 'Alex' });
  const joined = await send(guest, 'connect4:join', { code: created.code, name: 'Blair' });
  assert.equal((await send(host, 'connect4:drop', { column: 0 })).ok, true);
  const offline = nextUpdate(host, 'connect4:update', room => room.phase === 'playing' && online(room, false) === false);
  guest.disconnect();
  const paused = await offline;
  assert.equal(paused.board.filter(n => n !== 0).length, 1);
  assert.equal(paused.turnPlayerId, joined.room.you);
  const rejected = await send(host, 'connect4:drop', { column: 1 });
  assert.equal(rejected.ok, false);

  const recoveredGuest = await connected(t);
  const resumed = await send(recoveredGuest, 'connect4:resume', { code: created.code, token: joined.token });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.room.board.filter(n => n !== 0).length, 1);
  assert.equal(resumed.room.turnPlayerId, joined.room.you);
  assert.ok(resumed.room.players.every(p => p.online));
  assert.equal((await send(recoveredGuest, 'connect4:drop', { column: 1 })).ok, true);
  const snapshot = await send(host, 'connect4:resume', { code: created.code, token: created.token });
  assert.equal(snapshot.room.board.filter(n => n !== 0).length, 2);
  assert.equal(snapshot.room.turnPlayerId, created.room.you);
});


test('Reversi pauses after a disconnect and restores the exact turn, scores and board using the original token', { timeout: 25000 }, async t => {
  const host = await connected(t);
  const guest = await connected(t);
  const created = await send(host, 'reversi:create', { name: 'Alex' });
  const joined = await send(guest, 'reversi:join', { code: created.code, name: 'Blair' });
  assert.equal(created.ok, true);
  assert.equal(joined.ok, true);
  assert.deepEqual(joined.room.legalMoves, [19, 26, 37, 44]);
  assert.equal((await send(host, 'reversi:place', { index: 19 })).ok, true);
  const offline = nextUpdate(host, 'reversi:update', room => room.phase === 'playing' && online(room, false) === false);
  guest.disconnect();
  const paused = await offline;
  assert.equal(paused.scores.black, 4);
  assert.equal(paused.scores.white, 1);
  assert.equal(paused.board[27], 1);
  assert.equal(paused.turnPlayerId, joined.room.you);
  const blocked = await send(host, 'reversi:place', { index: 26 });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /reconnect|turn/);

  const guestAgain = await connected(t);
  const resumed = await send(guestAgain, 'reversi:resume', { code: created.code, token: joined.token });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.room.turnPlayerId, joined.room.you);
  assert.equal(resumed.room.board[19], 1);
  assert.equal(resumed.room.board[27], 1);
  assert.equal(resumed.room.scores.black, 4);
  assert.equal(resumed.room.players.every(p => p.online), true);
  assert.equal(JSON.stringify(resumed.room).includes(created.token), false);
  assert.equal(JSON.stringify(resumed.room).includes(joined.token), false);
  const place = await send(guestAgain, 'reversi:place', { index: resumed.room.legalMoves[0] });
  assert.equal(place.ok, true);
  const continued = await send(host, 'reversi:resume', { code: created.code, token: created.token });
  assert.equal(continued.room.moveCount, 2);
  assert.equal(continued.room.turnPlayerId, created.room.you);
});

test('switching a socket from Reversi to another game releases the previous Reversi seat', { timeout: 25000 }, async t => {
  const host = await connected(t);
  const guest = await connected(t);
  const created = await send(host, 'reversi:create', { name: 'Alex' });
  const joined = await send(guest, 'reversi:join', { name: 'Blair', code: created.code });
  assert.equal(joined.ok, true);
  const newGame = await send(host, 'connect4:create', { name: 'Alex' });
  assert.equal(newGame.ok, true);
  const guestView = await send(guest, 'reversi:resume', { code: created.code, token: joined.token });
  assert.equal(guestView.ok, true);
  assert.equal(online(guestView.room, true), false);
  assert.equal(online(guestView.room, false), true);
  assert.equal((await send(guest, 'reversi:place', { index: 19 })).ok, false);
  const restore = await send(host, 'reversi:resume', { code: created.code, token: created.token });
  assert.equal(restore.ok, true);
  assert.equal(restore.room.players.every(p => p.online), true);
});

test('All five online games release the original seat when the same socket resumes a different player', { timeout: 25000 }, async t => {
  for (const type of [
    { prefix: 'room', create: 'room:create', join: 'room:join', resume: 'room:resume', update: 'room:update' },
    { prefix: 'bingo', create: 'bingo:create', join: 'bingo:join', resume: 'bingo:resume', update: 'bingo:update' },
    { prefix: 'connect4', create: 'connect4:create', join: 'connect4:join', resume: 'connect4:resume', update: 'connect4:update' },
    { prefix: 'reversi', create: 'reversi:create', join: 'reversi:join', resume: 'reversi:resume', update: 'reversi:update' },
    { prefix: 'dots', create: 'dots:create', join: 'dots:join', resume: 'dots:resume', update: 'dots:update' },
  ]) {
    const host = await connected(t);
    const guest = await connected(t);
    const created = await send(host, type.create, { name: 'Alex', mode: 'unique' });
    const joined = await send(guest, type.join, { code: created.code, name: 'Blair' });
    assert.equal(created.ok, true, type.prefix);
    assert.equal(joined.ok, true, type.prefix);
    // Both valid tokens belong to the same room. The new identity must not
    // leave the socket falsely attached to both seats (a phantom online player).
    const switched = await send(host, type.resume, { code: created.code, token: joined.token });
    assert.equal(switched.ok, true, type.prefix);
    assert.equal(online(switched.room, true), false, `${type.prefix}: original host must be offline`);
    assert.equal(online(switched.room, false), true, `${type.prefix}: resumed guest must be online`);
    // The displaced guest cannot continue using an obsolete socket.
    const oldSeat = await send(guest, type.resume, { code: created.code, token: created.token });
    assert.equal(oldSeat.ok, true, type.prefix);
    assert.equal(oldSeat.room.players.every(player => player.online), true, type.prefix);
  }
});


test('Dots & Boxes keeps captured boxes, whose turn, and invite tokens intact across reconnect', {timeout:25000}, async t=>{
  const host=await connected(t),guest=await connected(t);
  const created=await send(host,'dots:create',{name:'Alex',size:3});
  const joined=await send(guest,'dots:join',{name:'Blair',code:created.code});
  assert.equal(created.ok,true);assert.equal(joined.ok,true);
  assert.equal(joined.room.size,3);
  assert.equal((await send(host,'dots:line',{index:0})).ok,true);
  const offline=nextUpdate(host,'dots:update',r=>r.roomPhase==='active'&&r.players.some(p=>p.number===2&&!p.online));
  guest.disconnect();
  const paused=await offline;
  assert.equal(paused.edges[0],1);
  assert.equal(paused.turn,2);
  assert.equal((await send(host,'dots:line',{index:1})).ok,false);
  const again=await connected(t);
  const resumed=await send(again,'dots:resume',{code:created.code,token:joined.token});
  assert.equal(resumed.ok,true);
  assert.equal(resumed.room.players.every(p=>p.online),true);
  assert.equal(resumed.room.edges[0],1);
  assert.equal(resumed.room.turn,2);
  assert.ok(!JSON.stringify(resumed.room).includes(joined.token));
  assert.ok(!JSON.stringify(resumed.room).includes(created.token));
  assert.equal((await send(again,'dots:line',{index:3})).ok,true);
  const hostView=await send(host,'dots:resume',{code:created.code,token:created.token});
  assert.equal(hostView.ok,true);
  assert.equal(hostView.room.moves.length,2);
  assert.equal(hostView.room.turn,1);
  assert.equal((await send(host,'dots:line',{index:12})).ok,true);
  assert.equal((await send(again,'dots:line',{index:13})).ok,true);
  const box=await send(host,'dots:resume',{code:created.code,token:created.token});
  assert.equal(box.room.owners[0],2);
  assert.deepEqual(box.room.scores,[0,1]);
  assert.equal(box.room.turn,2,'closing a box grants another turn');
});
