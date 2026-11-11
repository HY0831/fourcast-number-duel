export type Disc=0|1|2;export type PlayerDisc=1|2;
export const REVERSI_SIZE:8;export const REVERSI_CELLS:64;export const BLACK:1;export const WHITE:2;
export function startingBoard():Disc[];
export function flipsForMove(board:Disc[],index:number,disc:PlayerDisc):number[];
export function legalMoves(board:Disc[],disc:PlayerDisc):number[];
export function playDisc(board:Disc[],index:number,disc:PlayerDisc):{board:Disc[];flipped:number[]};
export function discCounts(board:Disc[]):{black:number;white:number;empty:number};
