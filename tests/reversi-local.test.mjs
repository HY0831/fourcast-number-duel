import test from 'node:test';
import assert from 'node:assert/strict';
import {BLACK,WHITE,startingBoard,legalMoves,playDisc,discCounts,flipsForMove} from '../client/src/games/reversi/reversi-rules.mjs';
import {freshLocal,playLocal,resignLocal,rematchLocal,restoreLocal,inspectLocal,localPlayerName} from '../client/src/games/reversi/reversi-local.mjs';
test('shared client/server rules open with the official four moves',()=>{
 const b=startingBoard();
 assert.deepEqual(legalMoves(b,BLACK),[19,26,37,44]);
 assert.deepEqual(legalMoves(b,WHITE),[20,29,34,43]);
 assert.deepEqual(playDisc(b,19,BLACK).flipped,[27]);
 assert.deepEqual(discCounts(b),{black:2,white:2,empty:60});
});
test('same-device Reversi starts as Black, alternates and stores board history',()=>{
 const a=freshLocal();assert.equal(a.turn,BLACK);assert.deepEqual(inspectLocal(a).legal,[19,26,37,44]);
 const b=playLocal(a,19);
 assert.equal(b.turn,WHITE);assert.equal(b.moves.length,1);assert.equal(b.board[27],BLACK);
 assert.equal(b.moves[0].disc,BLACK);assert.deepEqual(b.moves[0].flipped,[27]);
 assert.deepEqual(a.board,startingBoard());
 assert.throws(()=>playLocal(b,0),/highlighted/);
});
test('same-device resign awards the game, rematch swaps colours and resets the board',()=>{
 const a=freshLocal(1,['Alice','Bea']);
 assert.equal(localPlayerName(a,BLACK),'Alice');
 const b=resignLocal(a);
 assert.equal(b.winner,WHITE);assert.equal(b.resignedBy,BLACK);assert.equal(b.phase,'finished');
 assert.throws(()=>playLocal(b,19),/finished/);
 const c=rematchLocal(b);
 assert.equal(c.blackSeat,1);assert.equal(c.round,2);assert.equal(localPlayerName(c,BLACK),'Bea');
 assert.equal(c.turn,BLACK);assert.deepEqual(c.board,startingBoard());assert.equal(c.moves.length,0);
});
test('local autosave replays move history, rejects invalid snapshots and restores resignation',()=>{
 const a=playLocal(freshLocal(),19);
 const saved=restoreLocal(JSON.parse(JSON.stringify(a)));
 assert.deepEqual(saved,a);
 const finished=resignLocal(a);
 assert.deepEqual(restoreLocal(JSON.parse(JSON.stringify(finished))),finished);
 assert.deepEqual(restoreLocal({...a,board:Array(64).fill(1)}),freshLocal());
 assert.deepEqual(restoreLocal({...a,moves:[{index:0,disc:BLACK,board:a.board,flipped:[]}]}),freshLocal());
 assert.deepEqual(restoreLocal({}),freshLocal());
});
test('local engine automatically passes a colour with no legal moves',()=>{
 const a=freshLocal();
 const board=Array(64).fill(BLACK);
 board[27]=WHITE;board[45]=WHITE;board[26]=0;board[44]=0;
 assert.deepEqual(legalMoves(board,WHITE),[]);
 assert.ok(legalMoves(board,BLACK).includes(26));
 const state={...a,board,turn:BLACK};
 const b=playLocal(state,26);
 assert.equal(b.turn,BLACK);assert.equal(b.passed,WHITE);assert.equal(b.phase,'playing');
 const c=playLocal(b,44);
 assert.equal(c.phase,'finished');assert.equal(c.winner,BLACK);
 assert.deepEqual(discCounts(c.board),{black:64,white:0,empty:0});
});
test('local engine is deterministic with its network authoritative rule source',()=>{
 let board=startingBoard(),s=freshLocal();
 for(let i=0;i<12;i++){
  const moves=legalMoves(board,s.turn);
  assert.ok(moves.length>0);
  const move=moves[0];const res=playDisc(board,move,s.turn);
  s=playLocal(s,move);board=res.board;
  assert.deepEqual(s.board,board);
  assert.deepEqual(s.moves.at(-1).flipped,res.flipped);
  assert.deepEqual(flipsForMove(s.board,move,s.turn),[]);
 }
});
