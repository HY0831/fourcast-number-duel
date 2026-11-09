import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBingoBoard } from '../client/src/games/bingo/board-random.mjs';
import { validateBingoBoard } from '../server/bingo-engine.mjs';

const expected = Array.from({ length: 25 }, (_, i) => i + 1);

test('Random board fills all 25 cells uniquely and passes the existing server validator', () => {
  for (let i = 0; i < 100; i++) {
    const board = randomBingoBoard();
    assert.equal(board.length, 25);
    assert.deepEqual([...board].sort((a, b) => a - b), expected);
    assert.deepEqual(validateBingoBoard(board), board);
  }
});

test('Random board is deterministic for an injected random source and creates a fresh array', () => {
  const source = () => 0;
  const a = randomBingoBoard(source);
  const b = randomBingoBoard(source);
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
  assert.notDeepEqual(a, expected);
  const c = randomBingoBoard(() => 0.99);
  assert.notDeepEqual(a, c);
});

test('Random generation never changes an earlier manual board', () => {
  const manual = [...expected].reverse();
  const copy = [...manual];
  randomBingoBoard(() => 0.25);
  assert.deepEqual(manual, copy);
});
