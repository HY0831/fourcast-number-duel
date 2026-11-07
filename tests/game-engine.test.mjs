import test from 'node:test';
import assert from 'node:assert/strict';
import { countExact, GameStore, publicRoom, validateCode, validateGuess } from '../server/game-engine.mjs';

test('exact-place matches only: mispositioned digits produce no hint', () => {
  assert.equal(countExact('1234', '4321'), 0);
  assert.equal(countExact('1234', '1243'), 2);
  assert.equal(countExact('0007', '0004'), 3);
  assert.equal(countExact('0123', '0123'), 4);
});

test('repeated and unique modes accept leading zeros correctly', () => {
  assert.equal(validateCode('0011', 'repeat'), '0011');
  assert.equal(validateCode('0123', 'unique'), '0123');
  assert.throws(() => validateCode('0011', 'unique'), /different/);
  assert.throws(() => validateCode('123', 'repeat'), /four digits/);
  assert.throws(() => validateCode(1234, 'repeat'), /four digits/);
});

function activeRoom(mode = 'unique') {
  const store = new GameStore();
  const { room, player: a } = store.create('Alex', mode);
  const { player: b } = store.join(room.code, 'Blair');
  a.socketId = 'sock-a';
  b.socketId = 'sock-b';
  return { store, room, a, b };
}

test('join transitions to setup and hides both secret numbers', () => {
  const { store, room, a, b } = activeRoom();
  store.setSecret(room.code, a.token, '0123');
  store.setSecret(room.code, b.token, '5678');
  const snapshotA = publicRoom(room, a.id);
  const snapshotB = publicRoom(room, b.id);
  assert.equal(snapshotA.revealedSecrets, null);
  assert.equal(snapshotB.revealedSecrets, null);
  assert.equal(JSON.stringify(snapshotA).includes('5678'), false);
  assert.equal(JSON.stringify(snapshotB).includes('0123'), false);
  assert.equal(JSON.stringify(snapshotA).includes(a.token), false);
  assert.equal(JSON.stringify(snapshotA).includes(b.token), false);
  assert.equal(room.phase, 'playing');
});

test('turns alternate and first player with 4 exact matches wins', () => {
  const { store, room, a, b } = activeRoom();
  store.setSecret(room.code, a.token, '1234');
  store.setSecret(room.code, b.token, '5678');
  store.guess(room.code, a.token, '5876');
  assert.equal(room.guesses[0].exact, 2);
  assert.throws(() => store.guess(room.code, a.token, '5678'), /turn/);
  store.guess(room.code, b.token, '1234');
  assert.equal(room.winnerId, b.id);
  assert.equal(room.phase, 'finished');
  assert.deepEqual(publicRoom(room, a.id).revealedSecrets, { [a.id]: '1234', [b.id]: '5678' });
  assert.throws(() => store.guess(room.code, a.token, '5678'), /not started/);
});

test('guesses pause when an opponent is offline', () => {
  const { store, room, a, b } = activeRoom('repeat');
  store.setSecret(room.code, a.token, '1122');
  store.setSecret(room.code, b.token, '3344');
  b.socketId = null;
  assert.throws(() => store.guess(room.code, a.token, '3344'), /reconnect/);
});

test('host can change mode before secrets, but not afterwards', () => {
  const { store, room, a, b } = activeRoom();
  assert.throws(() => store.setMode(room.code, b.token, 'repeat'), /host/);
  store.setMode(room.code, a.token, 'repeat');
  store.setSecret(room.code, a.token, '1122');
  assert.throws(() => store.setMode(room.code, a.token, 'unique'), /before/);
});

test('rematches reset history and alternate first player', () => {
  const { store, room, a, b } = activeRoom();
  store.setSecret(room.code, a.token, '1234');
  store.setSecret(room.code, b.token, '5678');
  store.guess(room.code, a.token, '5678');
  assert.throws(() => store.rematch(room.code, b.token), /host/);
  store.rematch(room.code, a.token);
  assert.equal(room.round, 2);
  assert.equal(room.guesses.length, 0);
  store.setSecret(room.code, a.token, '1234');
  store.setSecret(room.code, b.token, '5678');
  assert.equal(room.players[room.turnIndex].id, b.id);
});

test('only token owner can recover reserved seat', () => {
  const { store, room, a } = activeRoom();
  const joined = store.join(room.code, null, a.token);
  assert.equal(joined.player.id, a.id);
  assert.throws(() => store.join(room.code, 'Intruder'), /full/);
});


test('unique mode restricts only secret codes, while guesses may repeat digits', () => {
  const { store, room, a, b } = activeRoom('unique');
  assert.throws(() => store.setSecret(room.code, a.token, '1111'), /different/);
  assert.equal(a.ready, false);
  store.setSecret(room.code, a.token, '1234');
  store.setSecret(room.code, b.token, '5678');

  store.guess(room.code, a.token, '1111');
  assert.equal(room.guesses[0].guess, '1111');
  assert.equal(room.guesses[0].exact, 0);
  assert.equal(room.players[room.turnIndex].id, b.id);
  store.guess(room.code, b.token, '0000');
  assert.equal(room.guesses[1].guess, '0000');
  assert.equal(room.players[room.turnIndex].id, a.id);
});

test('repeatable and unique modes accept repeated guesses, including leading zeros', () => {
  for (const mode of ['repeat', 'unique']) {
    assert.equal(validateGuess('0011'), '0011');
    assert.equal(validateGuess('9999'), '9999');
    const { store, room, a, b } = activeRoom(mode);
    store.setSecret(room.code, a.token, '1234');
    store.setSecret(room.code, b.token, '5678');
    store.guess(room.code, a.token, '0055');
    assert.equal(room.guesses[0].guess, '0055');
    assert.equal(room.guesses[0].exact, 0);
  }
});

test('invalid guess format rejects without consuming turn in either mode', () => {
  for (const mode of ['repeat', 'unique']) {
    const { store, room, a, b } = activeRoom(mode);
    store.setSecret(room.code, a.token, '1234');
    store.setSecret(room.code, b.token, '5678');
    for (const invalid of ['12', '12a4', '12345', 1234, null]) {
      assert.throws(() => store.guess(room.code, a.token, invalid), /four digits/);
      assert.equal(room.guesses.length, 0);
      assert.equal(room.players[room.turnIndex].id, a.id);
    }
  }
});

test('simultaneous rooms stay independent', () => {
  const store = new GameStore();
  const first = store.create('Alex', 'unique');
  const second = store.create('Chloe', 'repeat');
  assert.notEqual(first.room.code, second.room.code);
  assert.equal(first.room.mode, 'unique');
  assert.equal(second.room.mode, 'repeat');
  assert.equal(store.rooms.size, 2);
});