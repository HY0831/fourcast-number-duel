/**
 * Sudoku's own pure game engine; no server or Fourcast dependencies.
 * Each seed has one solution. They were generated and graded by logical techniques:
 * Easy = naked singles; Medium = some hidden singles; Hard = beyond singles.
 * Symmetry-preserving transforms produce fresh-looking puzzles without altering grade.
 */
export const SUDOKU_LEVELS = Object.freeze(['easy', 'medium', 'hard']);
export const LEVEL_META = Object.freeze({
  easy: { label: 'Easy', subtitle: 'A gentle warm-up', clueCount: 43 },
  medium: { label: 'Medium', subtitle: 'Think a little deeper', clueCount: 34 },
  hard: { label: 'Hard', subtitle: 'A proper brain workout', clueCount: 29 },
});

const BASE_SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const BASE_PUZZLES = Object.freeze({
  "easy": [
    "534670912000000300108340500009001423426850090713904000900537204200409005300280000",
    "504078902672095048000340560059000023420803700713900006961030000000410030045280070",
    "534608012600195000108040067809061400006003000713924006000037284207010005340200009"
  ],
  "medium": [
    "000070900002100340100302000809061000426000791010920056000030080007409005345200000",
    "000070900000090048108000000859000420400850091700004806960500004200409605305200070",
    "504608912070195040000040060000000020406853090700900000900530204207400035000006000"
  ],
  "hard": [
    "030070002002100308090042060800701000400000090703020000060000000080019005305200109",
    "034070000002005000100042500000061020400050790000004850901007284080010630000000000",
    "504070902070000340100300000850060420406003000700924000000007080080010005000006100"
  ]
});

export function isLevel(level) { return SUDOKU_LEVELS.includes(level); }
export function isGrid(value) { return typeof value === 'string' && /^[0-9]{81}$/.test(value); }
export function clueCount(puzzle) { return [...puzzle].filter(c => c !== '0').length; }

export function peersOf(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 81) throw new Error('Invalid cell');
  const row = Math.floor(index / 9), col = index % 9;
  const out = new Set();
  for (let n = 0; n < 9; n++) { out.add(row * 9 + n); out.add(n * 9 + col); }
  for (let r = Math.floor(row / 3) * 3; r < Math.floor(row / 3) * 3 + 3; r++)
    for (let c = Math.floor(col / 3) * 3; c < Math.floor(col / 3) * 3 + 3; c++) out.add(r * 9 + c);
  out.delete(index);
  return [...out];
}

function randomIndex(max, rng) {
  const n = Number(rng());
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('Random source must return [0, 1)');
  return Math.floor(n * max);
}
function shuffle(original, rng) {
  const arr = [...original];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, rng);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function rowOrColOrder(rng) {
  return shuffle([0, 1, 2], rng).flatMap(group => shuffle([0, 1, 2], rng).map(n => group * 3 + n));
}

/** Generate a unique-solution grid by permuting a verified unique seed. */
export function generateSudoku(level = 'easy', rng = Math.random) {
  if (!isLevel(level)) throw new Error('Invalid Sudoku difficulty');
  const seeds = BASE_PUZZLES[level];
  const seed = seeds[randomIndex(seeds.length, rng)];
  const rows = rowOrColOrder(rng), cols = rowOrColOrder(rng);
  const digits = shuffle(['1','2','3','4','5','6','7','8','9'], rng);
  const transpose = randomIndex(2, rng) === 1;
  function transform(str) {
    let out = '';
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const oldIndex = transpose ? cols[c] * 9 + rows[r] : rows[r] * 9 + cols[c];
      const value = str[oldIndex];
      out += value === '0' ? '0' : digits[Number(value) - 1];
    }
    return out;
  }
  const puzzle = transform(seed);
  const solution = transform(BASE_SOLUTION);
  if (!isGrid(puzzle) || !isGrid(solution) || clueCount(puzzle) !== LEVEL_META[level].clueCount) throw new Error('Invalid generated Sudoku');
  return { level, puzzle, solution };
}

export function getConflicts(board) {
  if (!isGrid(board)) throw new Error('Invalid board');
  const conflicts = new Set();
  const sets = [];
  for (let r = 0; r < 9; r++) sets.push(Array.from({length:9},(_,c)=>r*9+c));
  for (let c = 0; c < 9; c++) sets.push(Array.from({length:9},(_,r)=>r*9+c));
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    sets.push(Array.from({length:9},(_,k)=>(br*3+Math.floor(k/3))*9+bc*3+(k%3)));
  }
  for (const unit of sets) {
    const seen = new Map();
    for (const i of unit) {
      const v = board[i];
      if (v === '0') continue;
      if (seen.has(v)) { conflicts.add(i); conflicts.add(seen.get(v)); }
      else seen.set(v,i);
    }
  }
  return conflicts;
}

export function enterDigit(board, givens, index, digit) {
  if (!isGrid(board) || !isGrid(givens)) throw new Error('Invalid Sudoku grid');
  if (!Number.isInteger(index) || index < 0 || index >= 81) throw new Error('Invalid cell');
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) throw new Error('Invalid digit');
  if (givens[index] !== '0') return board;
  return board.slice(0, index) + String(digit) + board.slice(index+1);
}
export function isSolved(board, solution) {
  return isGrid(board) && isGrid(solution) && board === solution;
}
export function progress(board) {
  if (!isGrid(board)) return 0;
  return [...board].filter(v => v !== '0').length;
}
export function nextHint(board, solution, preferred = null) {
  if (!isGrid(board) || !isGrid(solution)) throw new Error('Invalid Sudoku grid');
  if (board === solution) return null;
  if (Number.isInteger(preferred) && preferred >= 0 && preferred < 81 && board[preferred] !== solution[preferred]) return preferred;
  return [...board].findIndex((value, index) => value !== solution[index]);
}