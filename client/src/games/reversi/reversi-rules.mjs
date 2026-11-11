/** Shared pure Reversi rules: identical for the trusted server and same-device mode. */
export const REVERSI_SIZE = 8;
export const REVERSI_CELLS = 64;
export const BLACK = 1;
export const WHITE = 2;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DIRECTIONS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const inBounds = (row,col) => row>=0&&row<REVERSI_SIZE&&col>=0&&col<REVERSI_SIZE;
const other = disc => disc===BLACK?WHITE:BLACK;

function requireBoard(board) {
  if(!Array.isArray(board)||board.length!==REVERSI_CELLS||board.some(v=>v!==0&&v!==BLACK&&v!==WHITE)) {
    throw new Error('Invalid Reversi board.');
  }
}
function requireDisc(disc) {
  if(disc!==BLACK&&disc!==WHITE)throw new Error('Invalid disc colour.');
}
function requirePosition(index) {
  if(!Number.isInteger(index)||index<0||index>=REVERSI_CELLS)throw new Error('Choose a valid square.');
}
export function startingBoard() {
  const board=Array(REVERSI_CELLS).fill(0);
  board[3*8+3]=WHITE;
  board[3*8+4]=BLACK;
  board[4*8+3]=BLACK;
  board[4*8+4]=WHITE;
  return board;
}
function flipsUnchecked(board,index,disc) {
  if(board[index]!==0)return [];
  const row=Math.floor(index/8),col=index%8,opponent=other(disc),all=[];
  for(const [dr,dc] of DIRECTIONS) {
    let r=row+dr,c=col+dc;
    const line=[];
    while(inBounds(r,c)&&board[r*8+c]===opponent){
      line.push(r*8+c);r+=dr;c+=dc;
    }
    if(line.length&&inBounds(r,c)&&board[r*8+c]===disc)all.push(...line);
  }
  return all;
}
export function flipsForMove(board,index,disc) {
  requireBoard(board);requirePosition(index);requireDisc(disc);
  return flipsUnchecked(board,index,disc);
}
export function legalMoves(board,disc) {
  requireBoard(board);requireDisc(disc);
  const result=[];
  for(let i=0;i<64;i++)if(board[i]===0&&flipsUnchecked(board,i,disc).length)result.push(i);
  return result;
}
export function playDisc(board,index,disc) {
  requireBoard(board);requirePosition(index);requireDisc(disc);
  if(board[index]!==0)throw new Error('That square is already occupied.');
  const flipped=flipsUnchecked(board,index,disc);
  if(!flipped.length)throw new Error('Choose a highlighted square that flips an opponent disc.');
  const next=[...board];
  next[index]=disc;
  for(const i of flipped)next[i]=disc;
  return {board:next,flipped};
}
export function discCounts(board) {
  requireBoard(board);
  return {black:board.filter(v=>v===BLACK).length,white:board.filter(v=>v===WHITE).length,
    empty:board.filter(v=>v===0).length};
}
