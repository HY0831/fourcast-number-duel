/** Pure Nonogram logic. No RNG: every puzzle is an authored fixed picture. */
export const MARK = Object.freeze({ EMPTY: 0, FILL: 1, CROSS: 2 });
export const MAX_HINTS = 3;
const HISTORY_LIMIT = 40;

export function runs(bits) {
  const out = [];
  let length = 0;
  for (const bit of bits) {
    if (Number(bit) === 1) length++;
    else if (length) { out.push(length); length = 0; }
  }
  if (length) out.push(length);
  return out.length ? out : [0];
}

export function cluesFor(puzzle) {
  const rows = puzzle.solution.map(row => runs([...row]));
  const columns = Array.from({ length: puzzle.width }, (_, c) =>
    runs(puzzle.solution.map(row => row[c])));
  return { rows, columns };
}

export function validatePuzzle(puzzle) {
  if (!puzzle || !/^[EMH]\d{2}$/.test(puzzle.id) || !puzzle.title ||
      !Number.isInteger(puzzle.width) || puzzle.width < 2 || puzzle.width > 15 ||
      puzzle.width !== puzzle.height || ![5, 10, 15].includes(puzzle.width) ||
      !Array.isArray(puzzle.solution) || puzzle.solution.length !== puzzle.height ||
      puzzle.solution.some(row => typeof row !== 'string' || row.length !== puzzle.width || /[^01]/.test(row))) return false;
  const clues = cluesFor(puzzle);
  return JSON.stringify(clues.rows) === JSON.stringify(puzzle.rowClues) &&
    JSON.stringify(clues.columns) === JSON.stringify(puzzle.colClues);
}

export function solutionCells(puzzle) { return puzzle.solution.join('').split('').map(Number); }
export function filledTotal(puzzle) { return solutionCells(puzzle).filter(Boolean).length; }
export function correctlyFilled(puzzle, cells) {
  const answer = solutionCells(puzzle);
  return cells.reduce((total, mark, i) => total + Number(mark === MARK.FILL && answer[i] === 1), 0);
}
export function isSolved(puzzle, cells) {
  if (!Array.isArray(cells) || cells.length !== puzzle.width * puzzle.height) return false;
  const answer = solutionCells(puzzle);
  return cells.every((mark, i) => (mark === MARK.FILL) === Boolean(answer[i]));
}
export function clueCompleted(puzzle, cells, isRow, index) {
  const answer = solutionCells(puzzle);
  const n = puzzle.width;
  for (let x = 0; x < n; x++) {
    const i = isRow ? index * n + x : x * n + index;
    if ((cells[i] === MARK.FILL) !== Boolean(answer[i])) return false;
  }
  return true;
}

export function freshSession(puzzle) {
  return { id: puzzle.id, marks: Array(puzzle.width * puzzle.height).fill(MARK.EMPTY),
    seconds: 0, hints: 0, status: 'ready', history: [] };
}

export function restoreSession(input, puzzle) {
  const fresh = freshSession(puzzle);
  if (!input || input.id !== puzzle.id || !Array.isArray(input.marks) ||
      input.marks.length !== fresh.marks.length ||
      input.marks.some(x => !Number.isInteger(x) || x < 0 || x > 2)) return fresh;
  const seconds = Number.isInteger(input.seconds) && input.seconds >= 0 && input.seconds <= 315360000 ? input.seconds : 0;
  const hints = Number.isInteger(input.hints) && input.hints >= 0 && input.hints <= MAX_HINTS ? input.hints : 0;
  const status = isSolved(puzzle, input.marks) ? 'completed' :
    (input.status === 'playing' || input.marks.some(Boolean) || hints > 0 ? 'playing' : 'ready');
  const validHistory = Array.isArray(input.history) ? input.history.slice(-HISTORY_LIMIT).filter(entry =>
    entry && Array.isArray(entry.marks) && entry.marks.length === fresh.marks.length &&
    entry.marks.every(x => Number.isInteger(x) && x >= 0 && x <= 2) &&
    Number.isInteger(entry.hints) && entry.hints >= 0 && entry.hints <= MAX_HINTS).map(entry =>
    ({ marks: [...entry.marks], hints: entry.hints })) : [];
  return { id: puzzle.id, marks: [...input.marks], seconds, hints, status, history: validHistory };
}

function change(session, puzzle, index, value, isHint) {
  if (session.status === 'completed' || !Number.isInteger(index) ||
      index < 0 || index >= session.marks.length ||
      ![MARK.EMPTY, MARK.FILL, MARK.CROSS].includes(value) || session.marks[index] === value) return session;
  const marks = [...session.marks]; marks[index] = value;
  const history = [...session.history.slice(-(HISTORY_LIMIT - 1)), { marks: [...session.marks], hints: session.hints }];
  return { ...session, marks, history, hints: session.hints + Number(isHint),
    status: isSolved(puzzle, marks) ? 'completed' : 'playing' };
}

export function toggleMark(session, puzzle, index, mode) {
  if (mode !== 'fill' && mode !== 'cross') return session;
  const value = mode === 'fill' ? MARK.FILL : MARK.CROSS;
  return change(session, puzzle, index, session.marks[index] === value ? MARK.EMPTY : value, false);
}
export function undoMark(session, puzzle) {
  if (session.status === 'completed' || !session.history.length) return session;
  const last = session.history.at(-1);
  return { ...session, marks: [...last.marks], hints: last.hints, history: session.history.slice(0, -1),
    status: last.marks.every(v => v === MARK.EMPTY) && last.hints === 0 ? 'ready' : 'playing' };
}
export function hintMark(session, puzzle) {
  if (session.status === 'completed' || session.hints >= MAX_HINTS) return session;
  const answer = solutionCells(puzzle);
  // Correct mistakes first, then uncover a genuine filled square. Never silently erase progress.
  let index = session.marks.findIndex((v, i) => v === MARK.FILL && answer[i] === 0);
  if (index >= 0) return change(session, puzzle, index, MARK.CROSS, true);
  index = session.marks.findIndex((v, i) => v !== MARK.FILL && answer[i] === 1);
  return index < 0 ? session : change(session, puzzle, index, MARK.FILL, true);
}

/** Generate every binary line mask consistent with the clues, size <= 15. */
export function lineCandidates(size, clues) {
  if (!Number.isInteger(size) || size < 1 || size > 15 || !Array.isArray(clues)) return [];
  const groups = clues.length === 1 && clues[0] === 0 ? [] : clues;
  if (groups.some(n => !Number.isInteger(n) || n <= 0) ||
      groups.reduce((sum, n) => sum + n, 0) + Math.max(0, groups.length - 1) > size) return [];
  if (!groups.length) return [0];
  const candidates = [];
  function place(g, from, mask) {
    if (g === groups.length) { candidates.push(mask); return; }
    const minRemaining = groups.slice(g + 1).reduce((s, v) => s + v, 0) + (groups.length - g - 1);
    const run = groups[g];
    for (let start = from; start + run + minRemaining <= size; start++) {
      const bits = ((1 << run) - 1) << start;
      place(g + 1, start + run + 1, mask | bits);
    }
  }
  place(0, 0, 0);
  return candidates;
}

/** Exact solution count (capped), with candidate-line constraint propagation. */
export function countSolutions(puzzle, cap = 2) {
  if (!validatePuzzle(puzzle)) return { count: 0, solvedByPropagation: false, solution: null };
  const n = puzzle.width, high = Math.min(2, Math.max(1, cap));
  const original = [
    ...puzzle.rowClues.map(clues => lineCandidates(n, clues)),
    ...puzzle.colClues.map(clues => lineCandidates(n, clues)),
  ];
  let count = 0, solution = null, branchOccurred = false;
  function propagate(domains) {
    let changed;
    do {
      changed = false;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const row = domains[r], col = domains[n + c];
        if (!row.length || !col.length) return null;
        const rowZero = row.some(mask => !(mask & (1 << c)));
        const rowOne = row.some(mask => Boolean(mask & (1 << c)));
        const colZero = col.some(mask => !(mask & (1 << r)));
        const colOne = col.some(mask => Boolean(mask & (1 << r)));
        const allowZero = rowZero && colZero, allowOne = rowOne && colOne;
        if (!allowZero && !allowOne) return null;
        if ((!allowZero || !allowOne) && (row.length > 1 || col.length > 1)) {
          const rr = row.filter(mask => allowOne ? Boolean(mask & (1 << c)) : !(mask & (1 << c)));
          const cc = col.filter(mask => allowOne ? Boolean(mask & (1 << r)) : !(mask & (1 << r)));
          if (!rr.length || !cc.length) return null;
          if (rr.length !== row.length) { domains[r] = rr; changed = true; }
          if (cc.length !== col.length) { domains[n + c] = cc; changed = true; }
        }
      }
    } while (changed);
    return domains;
  }
  function search(domains, depth) {
    if (count >= high) return;
    const current = propagate(domains);
    if (!current) return;
    let selected = -1, fewest = Infinity;
    for (let i = 0; i < current.length; i++) {
      const len = current[i].length;
      if (len > 1 && len < fewest) { selected = i; fewest = len; }
    }
    if (selected < 0) {
      count++;
      if (!solution) solution = current.slice(0, n).map(mask =>
        Array.from({ length: n }, (_, i) => mask & (1 << i) ? '1' : '0').join(''));
      return;
    }
    branchOccurred = true;
    for (const mask of current[selected]) {
      const clone = current.map(candidates => [...candidates]);
      clone[selected] = [mask];
      search(clone, depth + 1);
      if (count >= high) break;
    }
  }
  search(original, 0);
  return { count, solvedByPropagation: count === 1 && !branchOccurred, solution };
}
