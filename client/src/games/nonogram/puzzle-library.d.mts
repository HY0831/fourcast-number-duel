export type NonogramDifficulty = 'Easy' | 'Medium' | 'Hard';
export type NonogramPuzzle = {
  id: string;
  title: string;
  category: string;
  difficulty: NonogramDifficulty;
  width: number;
  height: number;
  solution: string[];
  rowClues: number[][];
  colClues: number[][];
};
export const PUZZLES: readonly NonogramPuzzle[];
export const DIFFICULTIES: NonogramDifficulty[];
export const CATEGORIES: string[];
export function findPuzzle(id: string): NonogramPuzzle | null;
