/**
 * Playgrove Minesweeper: framework-independent, deterministic when supplied RNG.
 * The minefield is generated only after the first reveal and keeps its 3x3
 * neighborhood clear, so the opening move always exposes a useful safe area.
 */
export const MINESWEEPER_LEVELS = Object.freeze({
  easy: Object.freeze({ rows: 9, cols: 9, mines: 10, label: 'Easy' }),
  medium: Object.freeze({ rows: 16, cols: 16, mines: 40, label: 'Medium' }),
  hard: Object.freeze({ rows: 16, cols: 30, mines: 99, label: 'Hard' }),
});

const validLevel = level => Object.hasOwn(MINESWEEPER_LEVELS, level);

export function createMinesweeper(level = 'easy') {
  if (!validLevel(level)) throw new RangeError('Unknown Minesweeper difficulty.');
  const { rows, cols, mines } = MINESWEEPER_LEVELS[level];
  return {
    level, rows, cols, mines,
    field: null,
    revealed: Array(rows * cols).fill(false),
    flags: Array(rows * cols).fill(false),
    status: 'ready',
    seconds: 0,
    explodedIndex: null,
  };
}

export function adjacentCells(index, rows, cols) {
  if (!Number.isInteger(index) || index < 0 || index >= rows * cols) return [];
  const r = Math.floor(index / cols), c = index % cols;
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) neighbors.push(nr * cols + nc);
    }
  }
  return neighbors;
}

export function createMinefield(level, firstIndex, random = Math.random) {
  if (!validLevel(level)) throw new RangeError('Unknown Minesweeper difficulty.');
  const { rows, cols, mines } = MINESWEEPER_LEVELS[level];
  const length = rows * cols;
  if (!Number.isInteger(firstIndex) || firstIndex < 0 || firstIndex >= length) throw new RangeError('Invalid first cell.');
  const protectedCells = new Set([firstIndex, ...adjacentCells(firstIndex, rows, cols)]);
  const choices = Array.from({ length }, (_, i) => i).filter(i => !protectedCells.has(i));
  if (mines > choices.length) throw new Error('Not enough safe cells for the opening move.');
  const field = Array(length).fill(0);
  // Partial Fisher–Yates: sample mine positions without replacement.
  for (let i = 0; i < mines; i++) {
    const value = random();
    if (!(value >= 0 && value < 1)) throw new RangeError('Random source must return a value from 0 to less than 1.');
    const j = i + Math.floor(value * (choices.length - i));
    [choices[i], choices[j]] = [choices[j], choices[i]];
    field[choices[i]] = -1;
  }
  for (let i = 0; i < length; i++) {
    if (field[i] === -1) continue;
    field[i] = adjacentCells(i, rows, cols).filter(n => field[n] === -1).length;
  }
  return field;
}

function isCell(index, state) {
  return Number.isInteger(index) && index >= 0 && index < state.rows * state.cols;
}

export function countFlags(state) {
  return state.flags.reduce((count, flagged) => count + Number(flagged), 0);
}

export function revealedSafeCount(state) {
  return state.revealed.reduce((count, opened, i) => count + Number(opened && state.field?.[i] !== -1), 0);
}

export function flagCell(state, index) {
  if (!isCell(index, state) || state.status === 'won' || state.status === 'lost' || state.revealed[index]) return state;
  const flags = [...state.flags];
  flags[index] = !flags[index];
  return { ...state, flags };
}

export function revealCell(state, index, random = Math.random) {
  if (!isCell(index, state) || state.status === 'won' || state.status === 'lost' || state.flags[index] || state.revealed[index]) return state;
  const field = state.field ?? createMinefield(state.level, index, random);
  const revealed = [...state.revealed];
  if (field[index] === -1) {
    revealed[index] = true;
    return { ...state, field, revealed, status: 'lost', explodedIndex: index };
  }
  // Reveal all connected zeroes and bordering numbered safe cells.
  const queue = [index];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    if (revealed[cell] || state.flags[cell] || field[cell] === -1) continue;
    revealed[cell] = true;
    if (field[cell] === 0) {
      for (const neighbor of adjacentCells(cell, state.rows, state.cols)) {
        if (!revealed[neighbor] && !state.flags[neighbor] && field[neighbor] !== -1) queue.push(neighbor);
      }
    }
  }
  const safeTotal = state.rows * state.cols - state.mines;
  const count = revealed.reduce((n, open, i) => n + Number(open && field[i] !== -1), 0);
  return { ...state, field, revealed, status: count === safeTotal ? 'won' : 'playing', explodedIndex: null };
}

/** Validate local storage data, rather than trusting stale or malformed data. */
export function restoreMinesweeper(value, level) {
  if (!validLevel(level) || !value || typeof value !== 'object') return createMinesweeper(level);
  const { rows, cols, mines } = MINESWEEPER_LEVELS[level];
  const length = rows * cols;
  const mask = array => Array.isArray(array) && array.length === length && array.every(x => typeof x === 'boolean');
  const status = value.status;
  const statuses = ['ready', 'playing', 'won', 'lost'];
  if (value.level !== level || value.rows !== rows || value.cols !== cols || value.mines !== mines ||
      !mask(value.revealed) || !mask(value.flags) || !statuses.includes(status) ||
      !Number.isInteger(value.seconds) || value.seconds < 0 || value.seconds > 10_000_000) return createMinesweeper(level);
  if (value.revealed.some((r, i) => r && value.flags[i])) return createMinesweeper(level);
  if (status === 'ready') {
    if (value.field !== null || value.revealed.some(Boolean)) return createMinesweeper(level);
    return { ...createMinesweeper(level), flags: [...value.flags], seconds: 0 };
  }
  if (!Array.isArray(value.field) || value.field.length !== length ||
      !value.field.every(x => Number.isInteger(x) && x >= -1 && x <= 8) ||
      value.field.filter(x => x === -1).length !== mines) return createMinesweeper(level);
  for (let i = 0; i < length; i++) {
    if (value.field[i] !== -1 && value.field[i] !== adjacentCells(i, rows, cols).filter(n => value.field[n] === -1).length) return createMinesweeper(level);
  }
  const safeOpen = value.revealed.reduce((count, open, i) => count + Number(open && value.field[i] !== -1), 0);
  const lostAt = value.explodedIndex;
  if (status === 'won' && safeOpen !== length - mines) return createMinesweeper(level);
  if (status === 'playing' && (safeOpen === length - mines || value.revealed.some((r, i) => r && value.field[i] === -1))) return createMinesweeper(level);
  if (status === 'lost' && (!isCell(lostAt, value) || value.field[lostAt] !== -1 || !value.revealed[lostAt])) return createMinesweeper(level);
  return { level, rows, cols, mines, status, seconds: value.seconds,
    field: [...value.field], revealed: [...value.revealed], flags: [...value.flags],
    explodedIndex: status === 'lost' ? lostAt : null };
}
