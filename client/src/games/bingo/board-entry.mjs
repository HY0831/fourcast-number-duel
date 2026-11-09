/**
 * Simple 1–25 Bingo board placement:
 * - tapping an empty cell adds the lowest unused number;
 * - tapping a filled cell clears it;
 * - existing manual/random arrangements are preserved elsewhere.
 */
export function nextUnplacedNumber(board) {
  for (let number = 1; number <= 25; number++) {
    if (!board.includes(number)) return number;
  }
  return null;
}

export function toggleBoardCell(board, index) {
  if (!Array.isArray(board) || board.length !== 25) throw new TypeError('Expected a 25-cell Bingo board.');
  if (!Number.isInteger(index) || index < 0 || index >= 25) throw new RangeError('Invalid Bingo cell.');
  const next = [...board];
  if (next[index] !== null) next[index] = null;
  else {
    const number = nextUnplacedNumber(next);
    if (number !== null) next[index] = number;
  }
  return next;
}
