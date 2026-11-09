import test from 'node:test';
import assert from 'node:assert/strict';
import { nextUnplacedNumber, toggleBoardCell } from '../client/src/games/bingo/board-entry.mjs';
import { validateBingoBoard } from '../server/bingo-engine.mjs';

const blank = () => Array(25).fill(null);

test('empty cells fill from 1 through 25 in tap order, not board position', () => {
  let board = blank();
  const order = [9, 0, 24, ...Array.from({length:25},(_,i)=>i).filter(i=>![9,0,24].includes(i))];
  order.forEach((index,turn) => {
    board = toggleBoardCell(board,index);
    assert.equal(board[index],turn+1);
    assert.equal(nextUnplacedNumber(board),turn===24?null:turn+2);
  });
  assert.deepEqual(validateBingoBoard(board),board);
});

test('tap on filled cell clears; next tap reuses lowest missing number', () => {
  let board=blank();
  board=toggleBoardCell(board,7); // 1
  board=toggleBoardCell(board,3); // 2
  board=toggleBoardCell(board,21); // 3
  board=toggleBoardCell(board,3); // clear 2
  assert.equal(board[3],null);
  assert.equal(nextUnplacedNumber(board),2);
  board=toggleBoardCell(board,10); // reuse 2
  assert.equal(board[10],2);
  assert.equal(board[7],1);
  assert.equal(board[21],3);
  assert.equal(new Set(board.filter(Boolean)).size,3);
});

test('random boards are still fully editable and preserve unique numbers', () => {
  const original = Array.from({length:25},(_,i)=>25-i);
  const first = toggleBoardCell(original,6);
  assert.equal(first[6],null);
  assert.equal(original[6],19); // source unmodified
  const restored = toggleBoardCell(first,6);
  assert.deepEqual(restored,original);
  assert.deepEqual(validateBingoBoard(restored),original);
});

test('the entry helper rejects out-of-range indices and malformed boards', () => {
  assert.throws(()=>toggleBoardCell([],0),/25-cell/);
  for(const index of [-1,25,1.5,'2',null]) assert.throws(()=>toggleBoardCell(blank(),index),/Invalid Bingo cell/);
});
