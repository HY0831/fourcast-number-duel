import type {HashiPuzzle} from './hashi-engine.mjs';
export const DIFFICULTIES:('Easy'|'Medium'|'Hard')[];
export const PUZZLES:HashiPuzzle[];
export function findPuzzle(id:string):HashiPuzzle|null;
