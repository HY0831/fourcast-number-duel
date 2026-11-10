import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MINESWEEPER_LEVELS, adjacentCells, createMinesweeper, createMinefield,
  revealCell, flagCell, countFlags, revealedSafeCount, restoreMinesweeper,
} from '../client/src/games/minesweeper/minesweeper-engine.mjs';

const rng = (seed = 12345) => () => {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 0x1_0000_0000;
};

for (const level of ['easy','medium','hard']) {
  const { rows, cols, mines } = MINESWEEPER_LEVELS[level];
  test(`${level}: correct classic dimensions, mine count, first-click safety and counts`, () => {
    const state = createMinesweeper(level);
    assert.equal(state.revealed.length,rows * cols);
    assert.equal(state.field,null);
    const first = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
    const field = createMinefield(level,first,rng());
    assert.equal(field.filter(x => x===-1).length,mines);
    for (const protectedIndex of [first,...adjacentCells(first,rows,cols)]) assert.notEqual(field[protectedIndex],-1);
    for (let i=0; i<rows*cols; i++) {
      if (field[i]===-1) continue;
      assert.equal(field[i],adjacentCells(i,rows,cols).filter(n => field[n]===-1).length,`Cell ${i}`);
    }
    const playing = revealCell(state,first,rng());
    assert.equal(playing.field[first],0);
    assert.equal(playing.field.filter(x=>x===-1).length,mines);
    assert.equal(playing.explodedIndex,null);
    assert.ok(revealedSafeCount(playing)>=9, 'the safe opening reveals the initial neighborhood');
  });

  test(`${level}: repeated seeds and first cell never expose a mine`, () => {
    for (let i=0; i<15; i++) {
      const first = (i * 37) % (rows*cols);
      const state = revealCell(createMinesweeper(level),first,rng(i+1));
      assert.equal(state.field[first],0);
      assert.notEqual(state.status,'lost');
      assert.equal(state.revealed[first],true);
    }
  });
}

test('neighbor counts are correct at corners, edges and center', () => {
  assert.deepEqual(adjacentCells(0,3,3),[1,3,4]);
  assert.equal(adjacentCells(1,3,3).length,5);
  assert.equal(adjacentCells(4,3,3).length,8);
  assert.deepEqual(adjacentCells(-1,3,3),[]);
});

test('first reveal floods safe zeroes; repeated reveals are ignored', () => {
  const s=createMinesweeper('easy');
  const opened=revealCell(s,40,rng(4));
  assert.ok(revealedSafeCount(opened)>9);
  assert.equal(opened.field[40],0);
  assert.strictEqual(revealCell(opened,40),opened);
});

test('flags toggle before first reveal; flagged cells cannot be opened', () => {
  const base=createMinesweeper('easy');
  const flagged=flagCell(base,35);
  assert.equal(countFlags(flagged),1);
  assert.equal(flagged.flags[35],true);
  assert.strictEqual(revealCell(flagged,35),flagged);
  assert.equal(flagged.field,null);
  const unflagged=flagCell(flagged,35);
  assert.equal(countFlags(unflagged),0);
  assert.equal(unflagged.flags[35],false);
  assert.equal(revealCell(unflagged,35,rng(3)).revealed[35],true);
});

test('opened squares cannot be flagged; invalid actions do nothing', () => {
  const s=revealCell(createMinesweeper('easy'),0,rng(3));
  assert.strictEqual(flagCell(s,0),s);
  assert.strictEqual(flagCell(s,-1),s);
  assert.strictEqual(revealCell(s,81),s);
  assert.strictEqual(revealCell(s,1.1),s);
});

test('revealing a mine loses and records the explosion; further input is ignored', () => {
  const s=revealCell(createMinesweeper('easy'),0,rng(5));
  const bomb=s.field.indexOf(-1);
  const lost=revealCell(s,bomb);
  assert.equal(lost.status,'lost');
  assert.equal(lost.explodedIndex,bomb);
  assert.equal(lost.revealed[bomb],true);
  assert.strictEqual(revealCell(lost,bomb),lost);
  assert.strictEqual(flagCell(lost,0),lost);
});

test('revealing every safe square wins without requiring any flags', () => {
  let s=revealCell(createMinesweeper('easy'),0,rng(9));
  const field=s.field;
  for (let i=0; i<field.length; i++) if(field[i]!==-1) s=revealCell(s,i);
  assert.equal(s.status,'won');
  assert.equal(revealedSafeCount(s),71);
  assert.equal(countFlags(s),0);
  assert.strictEqual(flagCell(s,field.indexOf(-1)),s);
});

test('saved games and flagged drafts restore, corrupt data resets safely', () => {
  const draft=flagCell(createMinesweeper('medium'),3);
  assert.deepEqual(restoreMinesweeper(JSON.parse(JSON.stringify(draft)),'medium'),draft);
  const running={...revealCell(createMinesweeper('medium'),75,rng(11)),seconds:42};
  assert.deepEqual(restoreMinesweeper(JSON.parse(JSON.stringify(running)),'medium'),running);
  assert.equal(restoreMinesweeper({...running,seconds:-1},'medium').status,'ready');
  assert.equal(restoreMinesweeper({...running,field:Array(256).fill(0)},'medium').status,'ready');
  assert.equal(restoreMinesweeper({...running,flags:Array(4).fill(false)},'medium').status,'ready');
  assert.throws(()=>createMinesweeper('expert'),/Unknown/);
  assert.throws(()=>createMinefield('easy',81),/Invalid first cell/);
});
