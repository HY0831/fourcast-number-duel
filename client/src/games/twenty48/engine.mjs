/** Playgrove 2048: dependency-free, deterministic game engine. */
export const GRID_SIZE = 4;
export const WIN_VALUE = 2048;
export const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);
const EMPTY = Array(GRID_SIZE * GRID_SIZE).fill(0);

function assertBoard(board) {
  if (!Array.isArray(board) || board.length !== 16 || !board.every(value => Number.isSafeInteger(value) && (value === 0 || (value >= 2 && Number.isInteger(Math.log2(value)))))) {
    throw new TypeError('A 2048 board must contain 16 valid powers of two or zero.');
  }
}
function safeRandom(random) {
  const n = random();
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new TypeError('Random source must return a finite number.');
  return Math.min(0.9999999999999999, Math.max(0, n));
}
export function spawnTile(board, random = Math.random) {
  assertBoard(board);
  const empty = board.map((value, index) => value === 0 ? index : -1).filter(index => index >= 0);
  if (empty.length === 0) return { board: [...board], index: null, value: null };
  const index = empty[Math.floor(safeRandom(random) * empty.length)];
  const value = safeRandom(random) < 0.9 ? 2 : 4;
  const next = [...board];
  next[index] = value;
  return { board: next, index, value };
}
export function createGame(random = Math.random) {
  const first = spawnTile(EMPTY, random);
  const second = spawnTile(first.board, random);
  return { board: second.board, score: 0, moves: 0, status: 'playing', reached2048: false, spawnIndex: second.index };
}
export function canMove(board) {
  assertBoard(board);
  if (board.includes(0)) return true;
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const value = board[row * 4 + col];
    if (col < 3 && value === board[row * 4 + col + 1]) return true;
    if (row < 3 && value === board[(row + 1) * 4 + col]) return true;
  }
  return false;
}
export function collapseLine(line) {
  if (!Array.isArray(line) || line.length !== 4) throw new TypeError('Expected four line values');
  const remaining = line.filter(Boolean);
  const result = [];
  let points = 0;
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i] === remaining[i + 1]) {
      const merged = remaining[i] * 2;
      result.push(merged);
      points += merged;
      i++;
    } else result.push(remaining[i]);
  }
  while (result.length < 4) result.push(0);
  return { line: result, points };
}
function indices(direction, line) {
  const result = [];
  for (let offset = 0; offset < 4; offset++) {
    if (direction === 'left') result.push(line * 4 + offset);
    else if (direction === 'right') result.push(line * 4 + (3 - offset));
    else if (direction === 'up') result.push(offset * 4 + line);
    else result.push((3 - offset) * 4 + line);
  }
  return result;
}
export function moveGame(game, direction, random = Math.random) {
  if (!DIRECTIONS.includes(direction)) throw new RangeError('Invalid direction');
  assertBoard(game.board);
  if (game.status !== 'playing') return { game, moved: false, gained: 0 };
  const next = [...game.board];
  let gained = 0;
  for (let line = 0; line < 4; line++) {
    const cells = indices(direction, line);
    const merged = collapseLine(cells.map(index => game.board[index]));
    cells.forEach((index, position) => { next[index] = merged.line[position]; });
    gained += merged.points;
  }
  if (next.every((n, i) => n === game.board[i])) return { game, moved: false, gained: 0 };
  const added = spawnTile(next, random);
  const reached2048 = Boolean(game.reached2048 || added.board.some(v => v >= WIN_VALUE));
  const status = !game.reached2048 && reached2048 ? 'won' : canMove(added.board) ? 'playing' : 'lost';
  return {
    game: { ...game, board: added.board, score: game.score + gained, moves: game.moves + 1, reached2048, status, spawnIndex: added.index },
    moved: true, gained
  };
}
export function continueAfterWin(game) {
  if (game.status !== 'won') return game;
  return { ...game, status: canMove(game.board) ? 'playing' : 'lost' };
}
export function maximumTile(board) { assertBoard(board); return Math.max(...board); }
export function restoreGame(value) {
  if (!value || typeof value !== 'object') return null;
  try {
    assertBoard(value.board);
    if (!Number.isSafeInteger(value.score) || value.score < 0 || !Number.isSafeInteger(value.moves) || value.moves < 0 ||
        !['playing','won','lost'].includes(value.status) || typeof value.reached2048 !== 'boolean') return null;
    const status = value.status === 'playing' && !canMove(value.board) ? 'lost' : value.status;
    if (value.status === 'won' && !value.reached2048) return null;
    return { board: [...value.board], score: value.score, moves: value.moves, status, reached2048: value.reached2048, spawnIndex: Number.isInteger(value.spawnIndex) && value.spawnIndex >= 0 && value.spawnIndex < 16 ? value.spawnIndex : null };
  } catch { return null; }
}
