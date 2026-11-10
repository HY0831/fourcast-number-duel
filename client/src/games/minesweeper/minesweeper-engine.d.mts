export type MineLevel = 'easy' | 'medium' | 'hard';
export type MineStatus = 'ready' | 'playing' | 'won' | 'lost';
export type MineSettings = { rows: number; cols: number; mines: number; label: string };
export type MineState = {
  level: MineLevel; rows: number; cols: number; mines: number;
  field: number[] | null; revealed: boolean[]; flags: boolean[];
  status: MineStatus; seconds: number; explodedIndex: number | null;
};
export const MINESWEEPER_LEVELS: Readonly<Record<MineLevel, Readonly<MineSettings>>>;
export function createMinesweeper(level?: MineLevel): MineState;
export function adjacentCells(index: number, rows: number, cols: number): number[];
export function createMinefield(level: MineLevel, firstIndex: number, random?: () => number): number[];
export function countFlags(state: MineState): number;
export function revealedSafeCount(state: MineState): number;
export function flagCell(state: MineState, index: number): MineState;
export function revealCell(state: MineState, index: number, random?: () => number): MineState;
export function restoreMinesweeper(value: unknown, level: MineLevel): MineState;
