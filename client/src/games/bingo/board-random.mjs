/**
 * Returns a fresh, uniformly shuffled 1–25 Bingo board using Fisher–Yates.
 * Does not change existing/manual boards until the caller chooses to replace one.
 */
export function randomBingoBoard(random = Math.random) {
  const numbers = Array.from({ length: 25 }, (_, index) => index + 1);
  for (let index = numbers.length - 1; index > 0; index--) {
    const swapWith = Math.floor(random() * (index + 1));
    [numbers[index], numbers[swapWith]] = [numbers[swapWith], numbers[index]];
  }
  return numbers;
}
