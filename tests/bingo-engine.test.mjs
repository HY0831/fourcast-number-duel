import test from 'node:test';
import assert from 'node:assert/strict';
import { BingoStore, validateBingoBoard, bingoCompletedLines, publicBingoRoom, BINGO_LINE_TARGET } from '../server/bingo-engine.mjs';

const ascending = Array.from({ length:25 }, (_, i) => i+1);
const descending = [...ascending].reverse();
const spread = (() => {
  const board = Array(25).fill(0);
  const special = [0,6,12,18];
  special.forEach((i,j) => {board[i]=22+j});
  let k=1;
  for(let i=0;i<25;i++) if(board[i]===0)board[i]=k++;
  return board;
})();
function roomPair() {
  const store=new BingoStore();
  const { room, player:a }=store.create('Alex');
  const { player:b }=store.join(room.code,'Blair');
  a.socketId='alice'; b.socketId='blair';
  return {store,room,a,b};
}

test('Bingo board must be 1–25 exactly once and manual positions are retained', () => {
  assert.deepEqual(validateBingoBoard(descending), descending);
  for(const board of [ascending.slice(0,24), [...ascending.slice(0,24),24],
    [...ascending.slice(0,24),0], [...ascending.slice(0,24),26],
    [...ascending.slice(0,24),'25'], [...ascending.slice(0,24),null],
    '123456789', {}]) {
    assert.throws(()=>validateBingoBoard(board),/25 cells manually/);
  }
  const arr=validateBingoBoard(ascending);arr[0]=25;assert.equal(ascending[0],1);
});

test('12 possible Bingo lines count rows, columns and diagonals', () => {
  const marks=[1,2,3,4,5,6,11,16,21,7,13,19,25];
  const lines=bingoCompletedLines(ascending,marks);
  assert.ok(lines.some(l=>JSON.stringify(l)===JSON.stringify([0,1,2,3,4])));
  assert.ok(lines.some(l=>JSON.stringify(l)===JSON.stringify([0,5,10,15,20])));
  assert.ok(lines.some(l=>JSON.stringify(l)===JSON.stringify([0,6,12,18,24])));
  assert.equal(bingoCompletedLines(ascending,ascending).length,12);
  assert.equal(bingoCompletedLines(null,ascending).length,0);
  assert.equal(BINGO_LINE_TARGET,5);
});

test('rooms start in lobby then setup and different socket sessions have private tokens', () => {
  const store=new BingoStore();const {room,player:a}=store.create('Alex');
  assert.equal(room.phase,'lobby');assert.equal(room.players.length,1);
  const {player:b}=store.join(room.code,'Blair');
  assert.equal(room.phase,'setup');assert.notEqual(a.token,b.token);
  assert.throws(()=>store.join(room.code,'Eve'),/full/);
  assert.equal(store.join(room.code,null,a.token).player.id,a.id);
  assert.throws(()=>store.authorize(room.code,'invalid'),/do not belong/);
});

test('each player must manually lock a unique complete board before game begins', () => {
  const {store,room,a,b}=roomPair();
  assert.throws(()=>store.lockBoard(room.code,a.token,ascending.slice(0,24)),/25 cells/);
  assert.equal(a.ready,false);
  store.lockBoard(room.code,a.token,ascending);
  assert.equal(room.phase,'setup');
  assert.throws(()=>store.lockBoard(room.code,a.token,ascending),/already locked/);
  store.lockBoard(room.code,b.token,descending);
  assert.equal(room.phase,'playing');
  assert.equal(room.players[room.turnIndex].id,a.id);
});

test('locked board layout remains secret from opponent and tokens never leak', () => {
  const {store,room,a,b}=roomPair();
  store.lockBoard(room.code,a.token,ascending);
  store.lockBoard(room.code,b.token,descending);
  const pa=publicBingoRoom(room,a.id),pb=publicBingoRoom(room,b.id);
  assert.deepEqual(pa.yourBoard,ascending);assert.deepEqual(pb.yourBoard,descending);
  assert.equal('board' in pa.players[1],false);
  assert.equal('board' in pb.players[0],false);
  assert.equal(JSON.stringify(pa).includes(a.token),false);
  assert.equal(JSON.stringify(pa).includes(b.token),false);
  assert.equal(JSON.stringify(pb).includes(a.token),false);
});

test('calls are authoritative and marked on both boards without revealing layouts', () => {
  const {store,room,a,b}=roomPair();
  store.lockBoard(room.code,a.token,ascending);store.lockBoard(room.code,b.token,descending);
  store.callNumber(room.code,a.token,1);
  assert.deepEqual(room.called,[1]);
  assert.equal(room.calls[0].by,a.id);
  assert.throws(()=>store.callNumber(room.code,a.token,2),/turn/);
  assert.throws(()=>store.callNumber(room.code,b.token,1),/already been called/);
  assert.throws(()=>store.callNumber(room.code,b.token,0),/from 1 to 25/);
  assert.throws(()=>store.callNumber(room.code,b.token,1.5),/from 1 to 25/);
  assert.throws(()=>store.callNumber(room.code,b.token,'2'),/from 1 to 25/);
  assert.equal(room.called.length,1);
  store.callNumber(room.code,b.token,2);
  assert.equal(room.called.length,2);
  assert.deepEqual(publicBingoRoom(room,b.id).called,[1,2]);
});

test('calls pause if either player goes offline', () => {
  const {store,room,a,b}=roomPair();
  store.lockBoard(room.code,a.token,ascending);store.lockBoard(room.code,b.token,descending);
  b.socketId=null;
  assert.throws(()=>store.callNumber(room.code,a.token,1),/reconnect/);
  assert.equal(room.called.length,0);
});

test('five completed lines wins; a single call can complete multiple lines', () => {
  const {store,room,a,b}=roomPair();
  store.lockBoard(room.code,a.token,ascending);store.lockBoard(room.code,b.token,spread);
  for(let n=1;n<=21;n++) {
    const token=n%2?a.token:b.token;
    store.callNumber(room.code,token,n);
  }
  assert.equal(room.phase,'finished');assert.equal(room.winnerId,a.id);assert.equal(room.draw,false);
  assert.ok(bingoCompletedLines(a.board,room.called).length>=5);
  assert.ok(bingoCompletedLines(b.board,room.called).length<5);
  assert.deepEqual(publicBingoRoom(room,b.id).players[0].board,ascending);
  assert.throws(()=>store.callNumber(room.code,b.token,22),/not started/);
});

test('simultaneous five-line BINGO is a draw even if one player called the number', () => {
  const {store,room,a,b}=roomPair();
  store.lockBoard(room.code,a.token,ascending);store.lockBoard(room.code,b.token,ascending);
  for(let n=1;room.phase==='playing'&&n<=25;n++)store.callNumber(room.code,n%2?a.token:b.token,n);
  assert.equal(room.phase,'finished');assert.equal(room.draw,true);assert.equal(room.winnerId,null);
});

test('rematch resets boards, calls and starts with opposite player', () => {
  const {store,room,a,b}=roomPair();
  store.lockBoard(room.code,a.token,ascending);store.lockBoard(room.code,b.token,ascending);
  for(let n=1;room.phase==='playing'&&n<=25;n++)store.callNumber(room.code,n%2?a.token:b.token,n);
  assert.throws(()=>store.rematch(room.code,b.token),/host/);
  store.rematch(room.code,a.token);
  assert.equal(room.phase,'setup');assert.equal(room.round,2);
  assert.deepEqual(room.called,[]);assert.deepEqual(room.calls,[]);
  assert.equal(room.players.every(p=>p.board===null&&!p.ready),true);
  store.lockBoard(room.code,a.token,ascending);store.lockBoard(room.code,b.token,descending);
  assert.equal(room.players[room.turnIndex].id,b.id);
});

test('expired rooms are rejected and cleanup purges old inactive sessions', () => {
  const s=new BingoStore();const {room}=s.create('Alice');
  room.updatedAt=Date.now()-4*60*60*1000;
  assert.throws(()=>s.requireRoom(room.code),/expired/);
  assert.equal(s.rooms.size,0);
});
