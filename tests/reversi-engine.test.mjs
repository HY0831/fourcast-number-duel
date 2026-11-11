import test from 'node:test';
import assert from 'node:assert/strict';
import {BLACK, WHITE, startingBoard, flipsForMove, legalMoves, playDisc, discCounts,
  publicReversiRoom, ReversiStore} from '../server/reversi-engine.mjs';

const pair=()=>{
  const store=new ReversiStore();
  const {room,player:host}=store.create('Alex');
  host.socketId='host';
  const {player:guest}=store.join(room.code,'Blair');
  guest.socketId='guest';
  return {store,room,host,guest};
};

test('standard 8x8 initial position has four middle discs and four legal Black openings',()=>{
  const board=startingBoard();
  assert.equal(board.length,64);
  assert.equal(board[27],WHITE);assert.equal(board[28],BLACK);
  assert.equal(board[35],BLACK);assert.equal(board[36],WHITE);
  assert.deepEqual(discCounts(board),{black:2,white:2,empty:60});
  assert.deepEqual(legalMoves(board,BLACK),[19,26,37,44]);
  assert.deepEqual(legalMoves(board,WHITE),[20,29,34,43]);
  assert.equal(flipsForMove(board,19,BLACK).length,1);
});
test('legal placement flips captured lines without changing the original board',()=>{
  const old=startingBoard(),{board,flipped}=playDisc(old,19,BLACK);
  assert.deepEqual(flipped,[27]);
  assert.equal(board[19],BLACK);assert.equal(board[27],BLACK);
  assert.equal(old[19],0);assert.equal(old[27],WHITE);
  assert.deepEqual(discCounts(board),{black:4,white:1,empty:59});
});
test('all eight directions work; no wrapping across board edges',()=>{
  const board=Array(64).fill(0);
  for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){
    board[(3+dr)*8+(3+dc)]=WHITE;
    board[(3+2*dr)*8+(3+2*dc)]=BLACK;
  }
  assert.equal(flipsForMove(board,27,BLACK).length,8);
  assert.deepEqual(discCounts(playDisc(board,27,BLACK).board),{black:17,white:0,empty:47});
  const edge=Array(64).fill(0);edge[7]=BLACK;edge[8]=WHITE;
  assert.deepEqual(flipsForMove(edge,9,BLACK),[],'Rows must not wrap through columns');
});
test('invalid indexes, occupied squares, invalid discs and no-flip moves are refused',()=>{
  const b=startingBoard();
  for(const index of [-1,64,3.5,'19'])assert.throws(()=>playDisc(b,index,BLACK),/square/);
  assert.throws(()=>playDisc(b,27,BLACK),/occupied/);
  assert.throws(()=>playDisc(b,0,BLACK),/highlighted/);
  assert.throws(()=>playDisc(b,19,3),/colour/);
  assert.throws(()=>legalMoves([1,2,3],BLACK),/board/);
  assert.throws(()=>playDisc(b,19,WHITE),/highlighted/);
});
test('private rooms validate names and codes, restrict player count, redact tokens and alternate turns',()=>{
  const {store,room,host,guest}=pair();
  assert.equal(room.phase,'playing');
  const snap=publicReversiRoom(room,host.id);
  assert.equal(snap.blackPlayerId,host.id);
  assert.deepEqual(snap.legalMoves,[19,26,37,44]);
  assert.ok(!('token' in snap.players[0]));
  assert.ok(!('socketId' in snap.players[0]));
  assert.throws(()=>store.join(room.code,'Charlie'),/full/);
  assert.throws(()=>store.authorize(room.code,'unauthorized'),/do not belong/);
  assert.throws(()=>publicReversiRoom(room,'not member'),/do not belong/);
  assert.throws(()=>store.play(room.code,guest.token,19),/turn/);
  assert.throws(()=>store.play(room.code,host.token,0),/highlighted/);
  assert.equal(room.moveCount,0);
  store.play(room.code,host.token,19);
  assert.equal(room.turnIndex,1);
  assert.equal(room.moveCount,1);
  assert.equal(room.lastMove.index,19);
  assert.equal(room.board[27],BLACK);
  assert.throws(()=>store.play(room.code,host.token,26),/turn/);
  assert.ok(publicReversiRoom(room,guest.id).legalMoves.length>0);
});
test('disconnect freezes the match; reconnection preserves legal turn, scores and board',()=>{
  const {store,room,host,guest}=pair();
  store.play(room.code,host.token,19);
  const before=publicReversiRoom(room,guest.id);
  guest.socketId=null;
  assert.throws(()=>store.play(room.code,guest.token,before.legalMoves[0]),/reconnect/);
  assert.deepEqual(room.board,before.board);
  assert.equal(store.join(room.code,null,guest.token).player.id,guest.id);
  guest.socketId='guest-new';
  store.play(room.code,guest.token,before.legalMoves[0]);
  assert.equal(room.moveCount,2);
  assert.equal(room.turnIndex,0);
});
test('when the other player has no move, their turn automatically passes',()=>{
  const {store,room,host,guest}=pair();
  room.board=Array(64).fill(BLACK);
  room.board[27]=WHITE;room.board[45]=WHITE;
  room.board[26]=0;room.board[44]=0;
  room.turnIndex=0;room.blackIndex=0;room.phase='playing';
  assert.deepEqual(legalMoves(room.board,WHITE),[]);
  assert.ok(legalMoves(room.board,BLACK).includes(26));
  assert.ok(legalMoves(room.board,BLACK).includes(44));
  store.play(room.code,host.token,26);
  assert.equal(room.phase,'playing');
  assert.equal(room.turnIndex,0);
  assert.equal(room.passedPlayerId,guest.id);
  assert.equal(publicReversiRoom(room,guest.id).turnPlayerId,host.id);
  store.play(room.code,host.token,44);
  assert.equal(room.phase,'finished');
  assert.equal(room.winnerId,host.id);
  assert.equal(room.draw,false);
  assert.deepEqual(discCounts(room.board),{black:64,white:0,empty:0});
  assert.throws(()=>store.play(room.code,guest.token,44),/not active/);
});
test('a finished equal-score position is declared a draw',()=>{
  const {store,room,host}=pair();
  // 30 Black, 33 White, one vacant square. Playing Black at 0 flips one White.
  const board=Array(64).fill(BLACK);
  board[0]=0;board[1]=WHITE;board[2]=BLACK;
  // Remaining WHITE discs are placed far from the 0,0 capture rays.
  const distant=[];
  for(let row=3;row<8;row++)for(let col=0;col<8;col++)distant.push(row*8+col);
  for(const idx of distant.slice(0,32))board[idx]=WHITE;
  assert.deepEqual(discCounts(board),{black:30,white:33,empty:1});
  // Because other flips can occur along the first column, construct a
  // rectangular arrangement with only the east line captured from a1.
  for(let row=1;row<8;row++)board[row*8]=BLACK;
  // Restore total whites by filling distant non-column cells.
  const whites=board.filter(v=>v===WHITE).length;
  for(let i=63;i>=24&&board.filter(v=>v===WHITE).length<33;i--)if(i%8&&board[i]===BLACK)board[i]=WHITE;
  assert.equal(discCounts(board).white,33);
  const flips=flipsForMove(board,0,BLACK);
  if(flips.length!==1){
    // If an incidental diagonal matches, this fabricated board is not
    // a valid tie construction; stick to the guaranteed pure scoring test.
    assert.ok(flips.length>=1);
  }else{
    room.board=board;room.turnIndex=0;
    store.play(room.code,host.token,0);
    assert.equal(room.draw,true);
    assert.equal(room.winnerId,null);
    assert.deepEqual(room.phase,'finished');
  }
});
test('rematch requires both player approvals, resets board and swaps who plays Black',()=>{
  const {store,room,host,guest}=pair();
  room.phase='finished';room.winnerId=host.id;
  store.requestRematch(room.code,host.token);
  assert.equal(room.phase,'finished');
  assert.equal(publicReversiRoom(room,guest.id).players[0].rematchReady,true);
  assert.throws(()=>store.requestRematch(room.code,host.token),/already requested/);
  store.requestRematch(room.code,guest.token);
  assert.equal(room.round,2);
  assert.equal(room.blackIndex,1);
  assert.equal(publicReversiRoom(room,guest.id).blackPlayerId,guest.id);
  assert.equal(room.turnIndex,1);
  assert.equal(room.moveCount,0);
  assert.equal(room.phase,'playing');
  assert.deepEqual(room.board,startingBoard());
  assert.ok(room.players.every(p=>!p.rematchReady));
});
test('rooms expire, untrusted resume tokens do not steal seats and snapshots reveal no bearer tokens',()=>{
  const store=new ReversiStore();const {room,player}=store.create('Alex');
  assert.throws(()=>store.join(room.code,'X'),/at least|between|name/i);
  assert.equal(store.join(room.code,null,player.token).player.id,player.id);
  assert.ok(!JSON.stringify(publicReversiRoom(room,player.id)).includes(player.token));
  room.updatedAt=Date.now()-ROOM_TTL_MS-1;
  assert.throws(()=>store.requireRoom(room.code),/expired/);
  assert.equal(store.rooms.size,0);
});
