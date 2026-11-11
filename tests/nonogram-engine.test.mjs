import test from 'node:test';
import assert from 'node:assert/strict';
import { PUZZLES, CATEGORIES, DIFFICULTIES, findPuzzle } from '../client/src/games/nonogram/puzzle-library.mjs';
import { MARK, MAX_HINTS, runs, cluesFor, validatePuzzle, filledTotal, correctlyFilled, isSolved,
  clueCompleted, freshSession, restoreSession, toggleMark, undoMark, hintMark, lineCandidates,
  countSolutions } from '../client/src/games/nonogram/nonogram-engine.mjs';

const heart = findPuzzle('E01');
const paintAnswer = (p) => p.solution.join('').split('').map(n=>n==='1'?MARK.FILL:MARK.EMPTY);

test('the curated library has exactly 30 named pictures and ten per difficulty', () => {
  assert.equal(PUZZLES.length,30);
  for(const level of DIFFICULTIES) assert.equal(PUZZLES.filter(p=>p.difficulty===level).length,10);
  assert.equal(new Set(PUZZLES.map(p=>p.id)).size,30);
  assert.equal(new Set(PUZZLES.map(p=>p.title)).size,30);
  assert.ok(PUZZLES.every(p=>CATEGORIES.includes(p.category)));
  for(const [level,size] of [['Easy',5],['Medium',10],['Hard',15]])
    assert.ok(PUZZLES.filter(p=>p.difficulty===level).every(p=>p.width===size&&p.height===size));
});

test('all 30 artwork matrices match all published row/column clues', () => {
  for(const p of PUZZLES) {
    assert.equal(validatePuzzle(p),true,`${p.id}: clues and dimensions must match artwork`);
    const generated=cluesFor(p);
    assert.deepEqual(generated.rows,p.rowClues);
    assert.deepEqual(generated.columns,p.colClues);
    assert.ok(filledTotal(p)>0);
  }
});

test('all 30 authored pictures have exactly one solution and need no guessing', () => {
  for(const p of PUZZLES) {
    const result=countSolutions(p);
    assert.equal(result.count,1,`${p.id} must be uniquely solvable`);
    assert.equal(result.solvedByPropagation,true,`${p.id} must solve by basic clue propagation`);
    assert.deepEqual(result.solution,p.solution,`${p.id} solver must reproduce the original picture`);
  }
});

test('run clues describe consecutive groups, including empty lines', () => {
  assert.deepEqual(runs('0011100110'),[3,2]);
  assert.deepEqual(runs('00000'),[0]);
  assert.deepEqual(runs('11111'),[5]);
  assert.deepEqual(lineCandidates(5,[2,1]).map(x=>x.toString(2)).length,3);
  assert.deepEqual(lineCandidates(5,[0]),[0]);
  assert.deepEqual(lineCandidates(5,[5]),[31]);
  assert.deepEqual(lineCandidates(5,[3,3]),[]);
});

test('fresh sessions are empty and do not expose solved artwork as player marks', () => {
  const s=freshSession(heart);
  assert.equal(s.status,'ready');assert.equal(s.marks.length,25);
  assert.ok(s.marks.every(v=>v===MARK.EMPTY));assert.deepEqual(s.history,[]);
  assert.equal(isSolved(heart,s.marks),false);
});

test('tap to fill, tap again to clear, tap X to mark and clear', () => {
  const s=freshSession(heart);
  const filled=toggleMark(s,heart,1,'fill');
  assert.equal(filled.status,'playing');assert.equal(filled.marks[1],MARK.FILL);
  assert.equal(s.marks[1],MARK.EMPTY,'state updates must be immutable');
  const cross=toggleMark(filled,heart,1,'cross');assert.equal(cross.marks[1],MARK.CROSS);
  const cleared=toggleMark(cross,heart,1,'cross');assert.equal(cleared.marks[1],MARK.EMPTY);
  const doubleFill=toggleMark(filled,heart,1,'fill');assert.equal(doubleFill.marks[1],MARK.EMPTY);
  assert.equal(toggleMark(filled,heart,-1,'fill'),filled);
  assert.equal(toggleMark(filled,heart,100,'cross'),filled);
});

test('mistaken fills prevent victory, while X marks are optional', () => {
  const answer=paintAnswer(heart);
  assert.equal(isSolved(heart,answer),true);
  const withCross=[...answer];withCross[0]=MARK.CROSS;
  assert.equal(isSolved(heart,withCross),true);
  assert.equal(clueCompleted(heart,withCross,true,0),true);
  assert.equal(clueCompleted(heart,withCross,false,0),true);
  withCross[0]=MARK.FILL;
  assert.equal(isSolved(heart,withCross),false);
  assert.equal(clueCompleted(heart,withCross,true,0),false);
  assert.equal(correctlyFilled(heart,withCross),filledTotal(heart));
});

test('the last correct fill completes the picture and stops further moves', () => {
  let s=freshSession(heart);const answer=paintAnswer(heart);
  for(let i=0;i<answer.length;i++)if(answer[i]===MARK.FILL)s=toggleMark(s,heart,i,'fill');
  assert.equal(s.status,'completed');assert.equal(isSolved(heart,s.marks),true);
  assert.equal(toggleMark(s,heart,0,'cross'),s);
  assert.equal(undoMark(s,heart),s);
  assert.equal(hintMark(s,heart),s);
});

test('undo restores previous mark and previous hint usage', () => {
  const s=freshSession(heart);
  const a=toggleMark(s,heart,0,'cross');const b=hintMark(a,heart);
  assert.equal(b.hints,1);
  const undone=undoMark(b,heart);
  assert.equal(undone.hints,0);
  assert.deepEqual(undone.marks,a.marks);
  assert.deepEqual(undoMark(undone,heart).marks,s.marks);
});

test('hint corrects a bad filled square first, then reveals true picture squares', () => {
  const wrong=toggleMark(freshSession(heart),heart,0,'fill');
  const fixed=hintMark(wrong,heart);
  assert.equal(fixed.marks[0],MARK.CROSS);assert.equal(fixed.hints,1);
  const next=hintMark(fixed,heart);
  assert.equal(next.hints,2);
  assert.equal(next.marks[1],MARK.FILL);
  const third=hintMark(next,heart);
  assert.equal(third.hints,MAX_HINTS);
  assert.equal(hintMark(third,heart),third);
});

test('restore rejects corrupted, mismatched or forged state', () => {
  const original=freshSession(heart);
  assert.deepEqual(restoreSession({id:'E02',marks:Array(25).fill(1)},heart),original);
  assert.deepEqual(restoreSession({id:'E01',marks:[0,1,2]},heart),original);
  assert.deepEqual(restoreSession({id:'E01',marks:Array(25).fill(9)},heart),original);
  const restored=restoreSession({id:'E01',marks:[...original.marks],status:'completed',seconds:-1,hints:99,history:[{}]},heart);
  assert.equal(restored.status,'ready');assert.equal(restored.seconds,0);assert.equal(restored.hints,0);
  assert.deepEqual(restored.history,[]);
});

test('restore recalculates completion instead of trusting saved status', () => {
  const answer=paintAnswer(heart);
  const solved=restoreSession({id:'E01',marks:answer,status:'playing',seconds:58,hints:1},heart);
  assert.equal(solved.status,'completed');assert.equal(solved.seconds,58);
  const incomplete=restoreSession({id:'E01',marks:Array(25).fill(0),status:'completed'},heart);
  assert.equal(incomplete.status,'ready');
});
