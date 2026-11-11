import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, spawnTile, collapseLine, moveGame, canMove, continueAfterWin, restoreGame, maximumTile } from '../client/src/games/twenty48/engine.mjs';
const g = (board) => ({ board, score: 0, moves: 0, status: 'playing', reached2048: false, spawnIndex: null });
const zeros = () => Array(16).fill(0);

test('new game starts with exactly two valid tiles', () => {
  const game = createGame(() => 0);
  assert.equal(game.board.filter(Boolean).length, 2);
  assert.equal(game.board.filter(Boolean).every(n => n === 2), true);
  assert.equal(game.score, 0);
  assert.equal(game.status, 'playing');
});
test('spawnTile chooses only empty cells and has 90:10 tile value rule', () => {
  const board = Array(16).fill(2); board[7] = 0;
  const high = spawnTile(board, () => 0.99), low = spawnTile(board, () => 0);
  assert.equal(high.index, 7); assert.equal(high.value, 4); assert.equal(low.value, 2);
  assert.equal(board[7], 0);
  assert.equal(spawnTile(Array(16).fill(2)).index, null);
});
test('line collapses once per pair, including triple and quadruple patterns', () => {
  assert.deepEqual(collapseLine([2,2,2,2]), { line: [4,4,0,0], points: 8 });
  assert.deepEqual(collapseLine([4,4,4,0]), { line: [8,4,0,0], points: 8 });
  assert.deepEqual(collapseLine([2,0,2,4]), { line: [4,4,0,0], points: 4 });
  assert.deepEqual(collapseLine([2,4,8,16]), { line: [2,4,8,16], points: 0 });
});
test('left movement merges and increases score, with exactly one new tile', () => {
  const board = [2,0,2,0,...Array(12).fill(0)];
  const result = moveGame(g(board),'left',()=>0);
  assert.equal(result.moved,true);assert.equal(result.gained,4);
  assert.equal(result.game.board[0],4);assert.equal(result.game.score,4);assert.equal(result.game.moves,1);
  assert.equal(result.game.board.filter(Boolean).length,2);
  assert.deepEqual(board.slice(0,4),[2,0,2,0]);
});
test('up, right, down directions respect row or column order', () => {
  const board=zeros();board[0]=2;board[4]=2;
  assert.equal(moveGame(g(board),'up',()=>0).game.board[0],4);
  assert.equal(moveGame(g(board),'down',()=>0).game.board[12],4);
  const row=zeros();row[0]=2;row[1]=2;
  assert.equal(moveGame(g(row),'right',()=>0).game.board[3],4);
});
test('an ineffective move changes nothing and never spawns', () => {
  const board=zeros();board[0]=2;
  const game=g(board);const result=moveGame(game,'up',()=>{throw Error('Should not spawn');});
  assert.deepEqual(result,{game,moved:false,gained:0});
});
test('game detects 2048 exactly once and lets user continue', () => {
  const board=zeros();board[0]=1024;board[1]=1024;
  const win=moveGame(g(board),'left',()=>0);
  assert.equal(win.game.status,'won');assert.equal(win.game.reached2048,true);assert.equal(maximumTile(win.game.board),2048);
  assert.equal(moveGame(win.game,'right').moved,false);
  const cont=continueAfterWin(win.game);assert.equal(cont.status,'playing');
  assert.equal(moveGame(cont,'right',()=>0).game.status,'playing');
});
test('full board with no adjacent equal tiles cannot move and is a loss after the last move', () => {
  const fixed=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];
  assert.equal(canMove(fixed),false);
  assert.equal(canMove([0,...fixed.slice(1)]),true);
  const game=g(fixed);const res=moveGame(game,'left',()=>0);
  assert.equal(res.moved,false);
  assert.throws(()=>moveGame(game,'diagonal'),/Invalid direction/);
});
test('canMove checks adjacent identical tiles even when full', () => {
  const board=[2,2,4,8,16,32,64,128,256,512,1024,2,4,8,16,32];
  assert.equal(canMove(board),true);
});
test('restoreGame rejects corrupt saved data and returns detached arrays', () => {
  assert.equal(restoreGame(null),null);
  assert.equal(restoreGame({board:Array(16).fill(3),score:0,moves:0,status:'playing',reached2048:false}),null);
  const game=createGame(()=>0);const restored=restoreGame(game);
  assert.deepEqual(restored,game);restored.board[0]=64;assert.notDeepEqual(restored.board,game.board);
});
