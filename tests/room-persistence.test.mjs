import test from 'node:test';
import assert from 'node:assert/strict';
import { GameStore, ROOM_TTL_MS } from '../server/game-engine.mjs';
import { BingoStore } from '../server/bingo-engine.mjs';
import { ConnectFourStore } from '../server/connect-four-engine.mjs';
import { serializeRoom, restoreRoom, snapshotStores, roomDiff, SNAPSHOT_VERSION } from '../server/room-persistence.mjs';

const createStores = () => ({
  games: new GameStore(),
  bingos: new BingoStore(),
  connectFours: new ConnectFourStore(),
});

function seedAll(stores) {
  const fourcast = stores.games.create('Alex', 'unique');
  const fGuest = stores.games.join(fourcast.room.code, 'Blair');
  fourcast.player.socketId = 'ephemeral-host-1';
  fGuest.player.socketId = 'ephemeral-guest-1';
  stores.games.setSecret(fourcast.room.code, fourcast.player.token, '0123');
  stores.games.setSecret(fourcast.room.code, fGuest.player.token, '4567');
  stores.games.guess(fourcast.room.code, fourcast.player.token, '1111');

  const bingo = stores.bingos.create('Clara');
  const bGuest = stores.bingos.join(bingo.room.code, 'Dina');
  bingo.player.socketId = 'ephemeral-host-2';
  bGuest.player.socketId = 'ephemeral-guest-2';
  const board = Array.from({ length: 25 }, (_, n) => n + 1);
  stores.bingos.lockBoard(bingo.room.code, bingo.player.token, board);
  stores.bingos.lockBoard(bingo.room.code, bGuest.player.token, [...board].reverse());
  stores.bingos.callNumber(bingo.room.code, bingo.player.token, 1);

  const connect4 = stores.connectFours.create('Evan');
  const cGuest = stores.connectFours.join(connect4.room.code, 'Faith');
  connect4.player.socketId = 'ephemeral-host-3';
  cGuest.player.socketId = 'ephemeral-guest-3';
  stores.connectFours.play(connect4.room.code, connect4.player.token, 2);
  return { fourcast, fGuest, bingo, bGuest, connect4, cGuest };
}

test('V5 snapshots preserve real secret, Bingo board and Connect Four move without socket IDs', () => {
  const stores = createStores();
  const seeded = seedAll(stores);
  for (const [kind, room] of [
    ['fourcast', seeded.fourcast.room], ['bingo', seeded.bingo.room], ['connect4', seeded.connect4.room],
  ]) {
    const serialized = serializeRoom(kind, room);
    assert.equal(serialized.version, SNAPSHOT_VERSION);
    assert.ok(serialized.state.players.every(p => !('socketId' in p)));
    const recovered = restoreRoom(serialized);
    assert.equal(recovered.code, room.code);
    assert.deepEqual(recovered.players.map(p => p.socketId), room.players.map(() => null));
    assert.deepEqual(serializeRoom(kind, recovered), serialized);
  }
  const f = restoreRoom(serializeRoom('fourcast', seeded.fourcast.room));
  assert.deepEqual(f.players.map(p => p.secret), ['0123', '4567']);
  assert.equal(f.guesses.length, 1);
  const b = restoreRoom(serializeRoom('bingo', seeded.bingo.room));
  assert.equal(b.called[0], 1);
  assert.equal(b.players[0].board.length, 25);
  const c = restoreRoom(serializeRoom('connect4', seeded.connect4.room));
  assert.equal(c.board.filter(Boolean).length, 1);
  assert.equal(c.turnIndex, 1);
});

test('V5 refuses invalid schema/tokens, and ignores rooms older than 3-hour TTL', () => {
  const stores = createStores();
  const { fourcast } = seedAll(stores);
  const doc = serializeRoom('fourcast', fourcast.room);
  assert.throws(() => restoreRoom({ ...doc, version: 99 }), /schema/);
  assert.throws(() => restoreRoom({ ...doc, state: { ...doc.state, players: [{ ...doc.state.players[0], token: 'bad' }] } }), /Invalid/);
  assert.equal(restoreRoom(doc, doc.updatedAt + ROOM_TTL_MS + 1), null);
  assert.equal(restoreRoom(doc, doc.updatedAt + ROOM_TTL_MS - 1)?.code, doc.code);
});

test('V5 diff changes only affected game rooms and ignores ephemeral socket ID changes', () => {
  const stores = createStores();
  const { fourcast, bingo, connect4, fGuest } = seedAll(stores);
  const before = snapshotStores(stores);
  fGuest.player.socketId = 'some-other-ephemeral-socket';
  assert.deepEqual(roomDiff(before, stores), { updates: [], deletes: [] });
  stores.connectFours.play(connect4.room.code, connect4.room.players[1].token, 3);
  const changes = roomDiff(before, stores);
  assert.deepEqual(changes.updates.map(x => x.kind), ['connect4']);
  assert.equal(changes.deletes.length, 0);
  stores.bingos.rooms.delete(bingo.room.code);
  const afterDelete = roomDiff(before, stores);
  assert.deepEqual(afterDelete.deletes, [{ kind: 'bingo', code: bingo.room.code }]);
  assert.equal(afterDelete.updates[0].code, connect4.room.code);
  assert.ok(stores.games.rooms.has(fourcast.room.code));
});

test('V5 restored rooms remain playable after both valid tokens reclaim their offline seats', () => {
  const original = createStores();
  const saved = seedAll(original);
  const restored = createStores();
  const originals = [
    ['fourcast', 'games', saved.fourcast.room],
    ['bingo', 'bingos', saved.bingo.room],
    ['connect4', 'connectFours', saved.connect4.room],
  ];
  for (const [kind, store, room] of originals) {
    const recovered = restoreRoom(serializeRoom(kind, room));
    restored[store].rooms.set(room.code, recovered);
    assert.ok(recovered.players.every(p => p.socketId === null));
    recovered.players[0].socketId = 'resumed-host';
    recovered.players[1].socketId = 'resumed-guest';
  }
  const four = restored.games.rooms.get(saved.fourcast.room.code);
  const guess = restored.games.guess(four.code, four.players[1].token, '9999');
  assert.equal(guess.guesses.length, 2);
  const bingo = restored.bingos.rooms.get(saved.bingo.room.code);
  restored.bingos.callNumber(bingo.code, bingo.players[1].token, 2);
  assert.deepEqual(bingo.called, [1, 2]);
  const connect4 = restored.connectFours.rooms.get(saved.connect4.room.code);
  restored.connectFours.play(connect4.code, connect4.players[1].token, 3);
  assert.equal(connect4.board.filter(Boolean).length, 2);
});
