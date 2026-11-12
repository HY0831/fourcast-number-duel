import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZES,edgeCount,boxCount,boxEdges,edgeInfo,freshGame,playLine,rematchGame,resignGame,replayGame,snapshotAt,restoreGame} from '../client/src/games/dots-boxes/dots-engine.mjs';
import {DotsStore,publicDotsRoom} from '../server/dots-engine.mjs';

test('all three supported board sizes have the exact legal line and square counts',()=>{
  for(const n of SIZES){
    const s=freshGame(n);
    assert.equal(s.edges.length,2*n*(n+1));
    assert.equal(s.owners.length,n*n);
    assert.equal(edgeCount(n),2*n*(n+1));
    assert.equal(boxCount(n),n*n);
    for(let r=0;r<n;r++)for(let c=0;c<n;c++)assert.equal(new Set(boxEdges(n,r,c)).size,4);
  }
  for(const n of [2,4,6,8])assert.throws(()=>freshGame(n),/3×3/);
  assert.throws(()=>edgeInfo(3,-1),/Invalid line/);
  assert.throws(()=>edgeInfo(5,60),/Invalid line/);
  assert.throws(()=>boxEdges(7,7,0),/Invalid box/);
});
test('drawing a fourth side claims a box and awards the next move to the same player',()=>{
  const target=boxEdges(3,0,0);
  let s=freshGame(3);
  s=playLine(s,target[0]);assert.equal(s.turn,2);
  s=playLine(s,target[1]);assert.equal(s.turn,1);
  s=playLine(s,target[2]);assert.equal(s.turn,2);
  s=playLine(s,target[3]);assert.equal(s.turn,2);
  assert.deepEqual(s.scores,[0,1]);
  assert.equal(s.owners[0],2);
  assert.deepEqual(s.moves.at(-1).claimed,[0]);
  assert.equal(s.edges[target[3]],2);
  assert.throws(()=>playLine(s,target[3]),/already been drawn/);
  assert.deepEqual(snapshotAt(s,3).owners,Array(9).fill(0));
  assert.equal(snapshotAt(s,3).turn,2);
  assert.deepEqual(snapshotAt(s,4).owners,s.owners);
});
test('completing one edge can capture two adjacent boxes and still yield only one extra turn',()=>{
  let s=freshGame(3);const left=boxEdges(3,0,0),right=boxEdges(3,0,1);
  const middle=left[3];assert.equal(right[2],middle);
  const first=[...new Set([...left,...right])].filter(x=>x!==middle);
  for(const e of first)s=playLine(s,e);
  assert.deepEqual(s.scores,[0,0]);assert.equal(s.moves.length,6);
  const player=s.turn;
  s=playLine(s,middle);
  assert.deepEqual(s.moves.at(-1).claimed,[0,1]);
  assert.equal(s.turn,player);
  assert.equal(s.scores[player-1],2);
});
test('a complete board ends immediately, every box has an owner and winner is largest score',()=>{
  let s=freshGame(3);
  for(let i=0;i<edgeCount(3);i++)s=playLine(s,i);
  assert.equal(s.phase,'finished');assert.equal(s.moves.length,24);
  assert.equal(s.scores.reduce((a,b)=>a+b,0),9);
  assert.ok(s.winner===1||s.winner===2);
  assert.equal(s.scores[s.winner-1],Math.max(...s.scores));
  assert.throws(()=>playLine(s,0),/already finished/);
});
test('rematches alternate starter and reset layout; resignation forfeits round',()=>{
  const a=freshGame(5),b=resignGame(a),c=rematchGame(b);
  assert.equal(b.phase,'finished');assert.equal(b.resignedBy,1);assert.equal(b.winner,2);
  assert.equal(c.round,2);assert.equal(c.startingPlayer,2);assert.equal(c.turn,2);
  assert.equal(c.edges.every(v=>v===0),true);
  assert.equal(rematchGame(resignGame(c)).startingPlayer,1);
  assert.throws(()=>rematchGame(a),/Finish/);
});
test('saved progress is replay-checked and corrupt history cannot claim free squares',()=>{
  let s=freshGame(7);
  for(const i of [0,7,49,50])s=playLine(s,i);
  assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(s))),s);
  assert.deepEqual(replayGame(s.size,s.moves,s.round,s.startingPlayer),s);
  assert.equal(restoreGame({...s,owners:s.owners.map(()=>1)}),null);
  assert.equal(restoreGame({...s,moves:[...s.moves,{index:0,player:1,claimed:[]}]}),null);
  assert.equal(restoreGame({...s,moves:s.moves.map(m=>({...m,claimed:[9]}))}),null);
  assert.deepEqual(restoreGame(resignGame(s)),resignGame(s));
});
test('online room is private, correctly sets board size, rejects extra seats and protects tokens',()=>{
  const store=new DotsStore(),{room,player:host}=store.create('Alex',7);host.socketId='one';
  assert.equal(room.game.size,7);assert.throws(()=>store.create('Alex',6),/3×3/);
  const {player:guest}=store.join(room.code,'Blair');guest.socketId='two';
  const info=publicDotsRoom(room,host.id);
  assert.equal(info.players.length,2);assert.equal(info.roomPhase,'active');
  assert.ok(!JSON.stringify(info).includes(host.token));
  assert.ok(!JSON.stringify(info).includes(guest.token));
  assert.throws(()=>store.join(room.code,'Intruder'),/full/);
  assert.throws(()=>store.play(room.code,guest.token,0),/turn/);
  store.play(room.code,host.token,0);
  assert.equal(room.game.edges[0],1);
  assert.throws(()=>store.play(room.code,host.token,1),/turn/);
  assert.throws(()=>store.play(room.code,guest.token,0),/already been drawn/);
  assert.throws(()=>store.authorize(room.code,'invalid'),/do not belong/);
  assert.equal(store.join(room.code,null,host.token).player.id,host.id);
});
test('disconnected player pauses online round; server resignation and mutual rematch preserve seats',()=>{
  const store=new DotsStore(),{room,player:host}=store.create('Alex',3);host.socketId='host';
  const {player:guest}=store.join(room.code,'Blair');guest.socketId='guest';
  guest.socketId=null;assert.throws(()=>store.play(room.code,host.token,0),/connect/);
  guest.socketId='new';
  store.play(room.code,host.token,0);
  store.resign(room.code,guest.token);
  assert.equal(room.game.phase,'finished');assert.equal(room.game.winner,1);assert.equal(room.game.resignedBy,2);
  assert.throws(()=>store.resign(room.code,guest.token),/finished/);
  store.rematch(room.code,host.token);assert.equal(room.game.round,1);
  store.rematch(room.code,guest.token);assert.equal(room.game.round,2);
  assert.equal(room.game.startingPlayer,2);assert.equal(room.game.moves.length,0);
  assert.equal(room.game.scores.join(','),'0,0');
});
test('stale rooms expire on access and cleanup preserves current rooms',()=>{
  const store=new DotsStore(),a=store.create('Alex',5),b=store.create('Blair',5);
  a.room.updatedAt=Date.now()-4*60*60*1000;
  assert.throws(()=>store.requireRoom(a.room.code),/expired/);
  store.cleanup();assert.equal(store.rooms.size,1);
  assert.equal(store.requireRoom(b.room.code),b.room);
});
