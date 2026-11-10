import test from 'node:test';
import assert from 'node:assert/strict';
import { ConnectFourStore, dropDisc, winningConnectFour, publicConnectFourRoom } from '../server/connect-four-engine.mjs';

const empty = () => Array(42).fill(0);
function pair() {
  const store = new ConnectFourStore();
  const { room, player: a } = store.create('Alex');
  const { player: b } = store.join(room.code, 'Blair');
  a.socketId = 'a'; b.socketId = 'b';
  return { store, room, a, b };
}

test('gravity places discs at bottom and rejects full or invalid columns', () => {
  let board = empty();
  for (let n = 0; n < 6; n++) {
    const move = dropDisc(board, 3, n % 2 + 1);
    assert.equal(move.index, (5 - n) * 7 + 3);
    board = move.board;
  }
  assert.throws(() => dropDisc(board, 3, 1), /full/);
  for (const column of [-1, 7, 2.5, '3', null]) assert.throws(() => dropDisc(empty(), column, 1), /column/);
  assert.throws(() => dropDisc(empty(), 3, 5), /player disc/);
  assert.deepEqual(empty(), Array(42).fill(0));
});

test('winning lines detected in both diagonals, verticals and horizontals', () => {
  for (const cells of [[35,36,37,38], [0,7,14,21], [0,8,16,24], [3,9,15,21]]) {
    const board = empty(); cells.forEach(i => board[i] = 1);
    assert.deepEqual(winningConnectFour(board,cells[2]), cells.slice().sort((a,b)=>a-b));
  }
  assert.deepEqual(winningConnectFour(empty(), 35), []);
});

test('create/join uses 6-character private codes, authenticates sessions and starts on join', () => {
  const store = new ConnectFourStore();
  const { room, player:a } = store.create('Alex');
  assert.match(room.code, /^[A-Z0-9]{6}$/);
  assert.equal(room.phase, 'lobby');
  assert.equal(a.isHost, true);
  const { player:b } = store.join(room.code, 'Blair');
  assert.equal(room.phase, 'playing');
  assert.equal(room.players[room.turnIndex].id, a.id);
  assert.notEqual(a.token,b.token);
  assert.throws(()=>store.join(room.code,'Third'), /full/);
  assert.equal(store.join(room.code,null,a.token).player.id,a.id);
  assert.throws(()=>store.authorize(room.code,'invalid'), /do not belong/);
  const payload=JSON.stringify(publicConnectFourRoom(room,b.id));
  assert.equal(payload.includes(a.token),false);assert.equal(payload.includes(b.token),false);
  assert.throws(()=>publicConnectFourRoom(room,'stranger'),/do not belong/);
});

test('turns are server-enforced, invalid moves do not change board or turn', () => {
  const { store,room,a,b } = pair();
  assert.throws(()=>store.play(room.code,b.token,0), /turn/);
  assert.throws(()=>store.play(room.code,a.token,7), /column/);
  assert.deepEqual(room.board,empty());
  store.play(room.code,a.token,0);
  assert.equal(room.board[35],1);
  assert.equal(room.turnIndex,1);
  assert.throws(()=>store.play(room.code,a.token,1),/turn/);
  assert.throws(()=>store.play(room.code,b.token,'1'),/column/);
  assert.equal(room.board.filter(Boolean).length,1);
  store.play(room.code,b.token,1);
  assert.equal(room.board[36],2);
});

test('disconnect stops moves and reconnecting preserves the turn and the existing board', () => {
  const {store,room,a,b}=pair();
  store.play(room.code,a.token,0);
  b.socketId = null;
  assert.throws(()=>store.play(room.code,b.token,1),/reconnect/);
  assert.equal(store.join(room.code,null,b.token).player.id,b.id);
  b.socketId='new';
  store.play(room.code,b.token,1);
  assert.equal(room.board[35],1);
  assert.equal(room.board[36],2);
});

test('four horizontal moves produce a server-verified winner and winning cells', () => {
  const {store,room,a,b}=pair();
  for (const [col,token] of [[0,a.token],[0,b.token],[1,a.token],[1,b.token],[2,a.token],[2,b.token],[3,a.token]]) store.play(room.code,token,col);
  assert.equal(room.phase,'finished');
  assert.equal(room.winnerId,a.id);
  assert.deepEqual(room.winningCells,[35,36,37,38]);
  assert.equal(publicConnectFourRoom(room,a.id).winnerId,a.id);
  assert.throws(()=>store.play(room.code,b.token,4),/not active/);
});

test('a full board with no winning line is a draw', () => {
  const {store,room,a,b}=pair();
  // Construct a legal near-full state with no four contiguous matching colours.
  // Different 2x2 colour bands ensure every row, column and diagonal run has <= 2.
  const rows=['1122112','2211221','1122112','2211221','1122112','2211221'];
  room.board=rows.join('').split('').map(Number);
  // Verify a draw scenario directly using one final legal move. This board
  // intentionally leaves one top cell vacant in a full column.
  room.board[0]=0;
  room.turnIndex=0;
  // If the prefilled board is itself invalid because of a diagonal, still a
  // last move that produces no win must produce a draw.
  const result=store.play(room.code,a.token,0);
  assert.equal(result.phase,'finished');
  assert.equal(result.draw,true);
  assert.equal(result.winnerId,null);
});

test('rematch needs both players, resets board and alternates starting player', () => {
  const {store,room,a,b}=pair();
  for (const [col,token] of [[0,a.token],[0,b.token],[1,a.token],[1,b.token],[2,a.token],[2,b.token],[3,a.token]]) store.play(room.code,token,col);
  store.requestRematch(room.code,a.token);
  assert.equal(room.phase,'finished');
  assert.equal(publicConnectFourRoom(room,b.id).players[0].rematchReady,true);
  assert.throws(()=>store.requestRematch(room.code,a.token),/already requested/);
  store.requestRematch(room.code,b.token);
  assert.equal(room.phase,'playing');
  assert.equal(room.round,2);
  assert.equal(room.players[room.turnIndex].id,b.id);
  assert.deepEqual(room.board,empty());
  assert.equal(room.players.every(p=>!p.rematchReady),true);
});

test('expired rooms cleaned up', () => {
  const store=new ConnectFourStore();const {room}=store.create('Alex');
  room.updatedAt=Date.now()-4*60*60*1000;
  assert.throws(()=>store.requireRoom(room.code),/expired/);
  assert.equal(store.rooms.size,0);
});
