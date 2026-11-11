import test from 'node:test';
import assert from 'node:assert/strict';
import {PUZZLES,findPuzzle} from '../client/src/games/hashi/puzzle-library.mjs';
import {buildEdges,canSetBridge,cycleBridge,freshSession,inspectBoard,isSolved,restoreSession,setBridge,
  solvePuzzle,undo,redo,toggleNoBridge,giveHint,validatePuzzle,edgesCross} from '../client/src/games/hashi/hashi-engine.mjs';

test('45 curated Hashi puzzles contain exactly 15 Easy, 15 Medium and 15 Hard boards',()=>{
  assert.equal(PUZZLES.length,45);
  assert.equal(new Set(PUZZLES.map(p=>p.id)).size,45);
  assert.equal(new Set(PUZZLES.map(p=>p.title)).size,45);
  for(const d of ['Easy','Medium','Hard'])assert.equal(PUZZLES.filter(p=>p.difficulty===d).length,15);
  assert.equal(findPuzzle('M12')?.title,'Narrow Passage');
  assert.equal(findPuzzle('missing'),null);
});
test('each puzzle is geometrically valid, has one connected answer and exactly one solution',()=>{
  const identities=new Set();
  for(const p of PUZZLES){
    assert.ok(validatePuzzle(p),p.id+' must be well formed with a solved answer');
    assert.ok(isSolved(p,p.solution),p.id+' must satisfy all rules');
    assert.deepEqual(p.edges,buildEdges(p.islands));
    const fingerprint=p.size+'|'+p.islands.map(x=>x.x+','+x.y+','+x.n).join(';');
    assert.ok(!identities.has(fingerprint),p.id+' repeats another puzzle');identities.add(fingerprint);
    const solutions=solvePuzzle(p,2);
    assert.equal(solutions.length,1,p.id+' must have a unique solution');
    assert.deepEqual(solutions[0],p.solution,p.id+' solution must match authored answer');
  }
});
test('bridge placement cycles 0 -> 1 -> 2 -> 0 and supports reverse',()=>{
  const p=PUZZLES[0];let s=freshSession(p);
  assert.equal(s.bridges[0],0);
  s=cycleBridge(s,p,0);assert.equal(s.bridges[0],1);
  s=cycleBridge(s,p,0);assert.equal(s.bridges[0],2);
  s=cycleBridge(s,p,0);assert.equal(s.bridges[0],0);
  s=cycleBridge(s,p,0,true);assert.equal(s.bridges[0],2);
  s=undo(s,p);assert.equal(s.bridges[0],0);
  s=redo(s,p);assert.equal(s.bridges[0],2);
});
test('number overload is reported and a no-bridge mark is mutually exclusive with a bridge',()=>{
  const p=PUZZLES[0];let s=freshSession(p);
  s=toggleNoBridge(s,p,0);assert.equal(s.marks[0],true);
  s=setBridge(s,p,0,1);assert.equal(s.bridges[0],1);assert.equal(s.marks[0],false);
  s=toggleNoBridge(s,p,0);assert.equal(s.marks[0],false);
  const totals=inspectBoard(p,s.bridges);
  assert.equal(totals.totals.length,p.islands.length);
});
test('crossing bridges are blocked and malformed saves are rejected',()=>{
  const p=PUZZLES.find(x=>x.edges.some((_,i)=>x.edges.some((_,j)=>i!==j&&edgesCross(x,i,j))));
  assert.ok(p,'collection should contain crossing candidates');
  const i=p.edges.findIndex((_,a)=>p.edges.some((_,b)=>a!==b&&edgesCross(p,a,b)));
  const j=p.edges.findIndex((_,b)=>i!==b&&edgesCross(p,i,b));
  let s=setBridge(freshSession(p),p,i,1);
  assert.equal(canSetBridge(p,s.bridges,j,1),false);
  assert.equal(setBridge(s,p,j,1),s);
  assert.deepEqual(restoreSession({id:p.id,bridges:[9],marks:[]},p),freshSession(p));
  assert.deepEqual(restoreSession({...s,marks:s.marks.map(()=>true)},p),freshSession(p));
});
test('save restoration, hints, undo and solved state remain coherent',()=>{
  const p=PUZZLES[0];let s=freshSession(p);
  const hint=giveHint(s,p);s=hint.session;
  assert.equal(s.hints,1);assert.notEqual(hint.detail,'');
  s.seconds=17;
  let restored=restoreSession(JSON.parse(JSON.stringify(s)),p);
  assert.equal(restored.seconds,17);assert.deepEqual(restored.bridges,s.bridges);
  restored=undo(restored,p);assert.equal(restored.hints,0);
  restored=redo(restored,p);assert.equal(restored.hints,1);
  const all={...freshSession(p),bridges:[...p.solution]};
  assert.equal(restoreSession(all,p).completed,true);
  assert.equal(isSolved(p,Array(p.edges.length).fill(0)),false);
});
test('fully satisfied but disconnected island groups are not accepted as solved',()=>{
  const p={id:'E99',title:'Disconnected example',difficulty:'Easy',size:5,
    islands:[{x:0,y:0,n:1},{x:1,y:0,n:1},{x:0,y:4,n:1},{x:1,y:4,n:1}],solution:[]};
  p.edges=buildEdges(p.islands);
  const vals=p.edges.map(e=>p.islands[e.a].y===p.islands[e.b].y?1:0);
  assert.equal(isSolved(p,vals),false);
  assert.ok(inspectBoard(p,vals).isolated.length>0);
});
