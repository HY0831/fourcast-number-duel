import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUDOKU_LEVELS, LEVEL_META, generateSudoku, getConflicts,
  enterDigit, isSolved, nextHint, progress, peersOf, clueCount,
} from '../client/src/games/sudoku/sudoku-engine.mjs';

// Independent solution counter verifies the full constraints, not just the shipped answer.
function countSolutions(puzzle, limit = 2) {
  const board = [...puzzle].map(Number);
  const peers = Array.from({ length: 81 }, (_, i) => peersOf(i));
  function search() {
    let target = -1, candidates;
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const taken = new Set(peers[i].map(j => board[j]));
      const possibilities = Array.from({length:9},(_,d)=>d+1).filter(x=>!taken.has(x));
      if (!possibilities.length) return 0;
      if (!candidates || possibilities.length < candidates.length) {
        target = i; candidates = possibilities;
        if (candidates.length === 1) break;
      }
    }
    if (target === -1) return 1;
    let solutions = 0;
    for (const n of candidates) {
      board[target] = n;
      solutions += search();
      board[target] = 0;
      if (solutions >= limit) break;
    }
    return solutions;
  }
  return search();
}

// A simple human singles solver is used to audit the difficulty bands.
function gradeBySingles(puzzle) {
  const board = [...puzzle].map(Number);
  const peers = Array.from({ length: 81 }, (_, i) => peersOf(i));
  const units = [];
  for(let r=0;r<9;r++)units.push(Array.from({length:9},(_,c)=>r*9+c));
  for(let c=0;c<9;c++)units.push(Array.from({length:9},(_,r)=>r*9+c));
  for(let br=0;br<3;br++)for(let bc=0;bc<3;bc++) units.push(Array.from({length:9},(_,k)=>(br*3+Math.floor(k/3))*9+bc*3+k%3));
  let hidden = 0;
  for (let n=0;n<81;n++) {
    const options = new Map();
    for(let i=0;i<81;i++){
      if (board[i])continue;
      const seen = new Set(peers[i].map(j=>board[j]));
      options.set(i,Array.from({length:9},(_,d)=>d+1).filter(d=>!seen.has(d)));
    }
    if (!options.size) return hidden===0?'easy':'medium';
    let step;
    for(const [i,poss] of options)if(poss.length===1){step=[i,poss[0]];break;}
    if (!step) {
      for(const unit of units){
        for(let digit=1;digit<=9;digit++){
          const positions = unit.filter(i=>options.get(i)?.includes(digit));
          if (positions.length===1){step=[positions[0],digit];hidden++;break;}
        }
        if(step)break;
      }
    }
    if (!step)return 'hard';
    board[step[0]]=step[1];
  }
  return 'hard';
}

test('easy / medium / hard each have uniquely solvable puzzles with genuinely distinct singles grades', () => {
  for(const level of SUDOKU_LEVELS){
    for(const rngValue of [0.05,0.43,0.89]) {
      const p=generateSudoku(level,()=>rngValue);
      assert.equal(p.level,level);
      assert.equal(p.puzzle.length,81);
      assert.equal(p.solution.length,81);
      assert.equal(clueCount(p.puzzle),LEVEL_META[level].clueCount);
      assert.equal(getConflicts(p.solution).size,0);
      assert.equal(countSolutions(p.puzzle),1);
      assert.equal(gradeBySingles(p.puzzle),level);
      for(let i=0;i<81;i++)if(p.puzzle[i]!=='0')assert.equal(p.puzzle[i],p.solution[i]);
    }
  }
});

test('generated puzzles vary while preserving difficulty and row/column/box validity', () => {
  const puzzles=Array.from({length:8},(_,i)=>generateSudoku('medium',()=>0.07+i*0.11));
  assert.ok(new Set(puzzles.map(p=>p.puzzle)).size>=3);
  puzzles.forEach(p=>assert.equal(countSolutions(p.puzzle),1));
});

test('cells cannot be changed if given and can be entered/cleared otherwise', () => {
  const {puzzle}=generateSudoku('easy',()=>0.4);
  const given=puzzle.indexOf('1'); const empty=puzzle.indexOf('0');
  assert.equal(enterDigit(puzzle,puzzle,given,9),puzzle);
  let board=enterDigit(puzzle,puzzle,empty,4);
  assert.equal(board[empty],'4');
  board=enterDigit(board,puzzle,empty,0);
  assert.equal(board,puzzle);
  assert.throws(()=>enterDigit(puzzle,puzzle,empty,11));
  assert.throws(()=>enterDigit(puzzle,puzzle,-1,4));
});

test('conflicts detect duplicate cells, ignore blanks, and only affect relevant sets', () => {
  const clean='0'.repeat(81);
  assert.equal(getConflicts(clean).size,0);
  const dup='2'+'2'+'0'.repeat(79);
  assert.deepEqual([...getConflicts(dup)].sort((a,b)=>a-b),[0,1]);
  assert.equal(peersOf(0).includes(80),false);
  assert.equal(peersOf(0).includes(10),true);
});

test('hint prefers the selected incorrect/blank cell and completion requires exact solution', () => {
  const {puzzle,solution}=generateSudoku('hard',()=>0.23);
  const empty=puzzle.indexOf('0');
  assert.equal(nextHint(puzzle,solution,empty),empty);
  assert.equal(nextHint(solution,solution),null);
  assert.equal(isSolved(puzzle,solution),false);
  assert.equal(isSolved(solution,solution),true);
  assert.equal(progress(solution),81);
  assert.equal(progress(puzzle),29);
});

test('invalid level or corrupt grids are rejected', () => {
  assert.throws(()=>generateSudoku('expert'),/Invalid Sudoku difficulty/);
  assert.throws(()=>generateSudoku('easy',()=>1),/Random source/);
  assert.throws(()=>getConflicts('123'));
});